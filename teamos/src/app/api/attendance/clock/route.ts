import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineMeters } from "@/lib/geo";
import { wibDateStr, wibTimeStr } from "@/lib/tz";

/** Server-side spoof score from raw browser signals (0–100). */
function scoreSignals(signals: Record<string, unknown>, accuracy: number): { score: number; hits: string[] } {
  const hits: string[] = [];
  let score = 0;
  if (signals.webdriver === true) { score += 40; hits.push("webdriver"); }
  if (accuracy > 150) { score += 20; hits.push("low_accuracy"); }
  if (Number(signals.tz_offset_min) !== -420) { score += 20; hits.push("tz_mismatch"); } // WIB = UTC+7
  if (signals.touch === false) { score += 10; hits.push("no_touch"); }
  const ua = String(signals.ua ?? "");
  if (/headless|electron|phantom/i.test(ua)) { score += 30; hits.push("headless_ua"); }
  return { score: Math.min(score, 100), hits };
}

export async function POST(request: Request) {
  const { profile } = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (profile.employment_status !== "active") {
    return NextResponse.json({ error: "employment not active" }, { status: 403 });
  }

  const fd = await request.formData();
  const kind = String(fd.get("kind"));
  const lat = Number(fd.get("lat"));
  const lng = Number(fd.get("lng"));
  const accuracy = Number(fd.get("accuracy") ?? 0);
  const selfie = fd.get("selfie") as File | null;
  let signals: Record<string, unknown> = {};
  try { signals = JSON.parse(String(fd.get("signals") ?? "{}")); } catch {}

  if (!["in", "out"].includes(kind) || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Office = the profile's entity, or NoraPadel for cross-entity ("Both") staff — one office (NORA P).
  const { data: entity } = profile.entity_id
    ? await admin.from("entities").select("*").eq("id", profile.entity_id).single()
    : await admin.from("entities").select("*").eq("name", "NoraPadel").single();
  if (!entity) return NextResponse.json({ error: "no entity configured" }, { status: 500 });

  const distance = haversineMeters(lat, lng, entity.office_lat, entity.office_lng);
  const { score, hits } = scoreSignals(signals, accuracy);
  const today = wibDateStr();

  // Hard reject beyond the geofence (200 m default) — logged, never stored as attendance.
  if (distance > entity.geofence_radius_m) {
    await admin.from("attendance_rejected_attempts").insert({
      profile_id: profile.id,
      kind,
      lat,
      lng,
      distance_m: distance,
      reason: `out_of_geofence (${distance} m > ${entity.geofence_radius_m} m)`,
      spoof_score: score,
      spoof_signals: hits,
    });
    return NextResponse.json({ rejected: true, distance }, { status: 422 });
  }

  // Selfie → private bucket, ≤300KB
  let selfiePath: string | null = null;
  if (selfie && selfie.size > 0) {
    if (selfie.size > 300 * 1024) {
      return NextResponse.json({ error: "selfie too large (max 300KB)" }, { status: 400 });
    }
    selfiePath = `${profile.id}/${today}-${kind}.jpg`;
    const buf = Buffer.from(await selfie.arrayBuffer());
    await admin.storage.from("selfies").upload(selfiePath, buf, {
      contentType: "image/jpeg",
      upsert: true,
    });
  }

  const now = new Date().toISOString();
  const flags: string[] = [];
  if (score >= 50) flags.push("spoof_suspect");

  if (kind === "in") {
    // Late = clock-in after work_start + grace, unless an approved izin_late covers today.
    const nowWIB = wibTimeStr();
    const [sh, sm] = String(entity.work_start_time).slice(0, 5).split(":").map(Number);
    const graceLimit = sh * 60 + sm + entity.late_grace_min;
    const [nh, nm] = nowWIB.split(":").map(Number);
    let late = nh * 60 + nm > graceLimit;

    let suppressedBy: string | null = null;
    if (late) {
      const { data: izin } = await admin
        .from("leave_requests")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("type", "izin_late")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();
      if (izin) {
        late = false;
        suppressedBy = izin.id;
      }
    }

    const { error } = await admin.from("attendance_records").upsert(
      {
        profile_id: profile.id,
        work_date: today,
        clock_in_at: now,
        clock_in_lat: lat,
        clock_in_lng: lng,
        clock_in_distance_m: distance,
        selfie_in_path: selfiePath,
        spoof_score: score,
        spoof_signals: hits,
        late,
        late_suppressed_by: suppressedBy,
        flags,
      },
      { onConflict: "profile_id,work_date" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, distance, late });
  }

  // clock out
  const { data: rec } = await admin
    .from("attendance_records")
    .select("id, spoof_score, flags")
    .eq("profile_id", profile.id)
    .eq("work_date", today)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: "belum absen masuk hari ini" }, { status: 400 });

  const { error } = await admin
    .from("attendance_records")
    .update({
      clock_out_at: now,
      clock_out_lat: lat,
      clock_out_lng: lng,
      clock_out_distance_m: distance,
      selfie_out_path: selfiePath,
      missing_clock_out: false,
      spoof_score: Math.max(rec.spoof_score ?? 0, score),
      flags: Array.from(new Set([...(rec.flags ?? []), ...flags])),
    })
    .eq("id", rec.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, distance });
}

import { requireProfile } from "@/lib/auth";
import { entityColor, entityLabel } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type DirectoryProfile = Profile & {
  departments: { name: string } | null;
  entities: { name: string } | null;
  roles: { name: string } | null;
};

export default async function DirectoryPage() {
  const { supabase } = await requireProfile();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*, departments(name), entities(name), roles(name)")
    .order("full_name");
  const { data: departments } = await supabase.from("departments").select("*").order("name");

  const list = (profiles ?? []) as DirectoryProfile[];
  const byDept = new Map<string, DirectoryProfile[]>();
  for (const p of list) {
    const dept = p.departments?.name ?? "Founder";
    const arr = byDept.get(dept) ?? [];
    arr.push(p);
    byDept.set(dept, arr);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Tim</h1>
      {[...byDept.entries()].map(([dept, people]) => {
        const note = departments?.find((d) => d.name === dept)?.note;
        return (
          <div key={dept}>
            <h2 className="mb-1 mt-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {dept} <span className="text-neutral-300">({people.length})</span>
            </h2>
            {note && <p className="mb-2 text-xs italic text-neutral-400">{note}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {people.map((p) => (
                <div key={p.id} className="card !p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {p.full_name}{" "}
                      {p.badge && (
                        <span className="chip bg-neutral-100 text-neutral-600">{p.badge}</span>
                      )}
                    </p>
                    <span
                      className="chip text-white"
                      style={{ backgroundColor: entityColor(p.entities?.name ?? null) }}
                    >
                      {entityLabel(p.entities?.name ?? null)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {p.roles?.name ?? "—"}
                    {p.employment_status === "not_started" && " · belum mulai"}
                    {p.work_type.startsWith("intern") && p.intern_end && ` · magang s/d ${p.intern_end}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

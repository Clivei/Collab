-- TeamOS Phase 0 seed — Appendix A roster (July 2026), 26 people + owner.
-- Placeholder emails {firstname}@teamos.local; owner uses his real email.

-- ── entities ────────────────────────────────────────────────────────
insert into entities (name) values ('NoraPadel'), ('Gridline Digital');

-- ── departments ─────────────────────────────────────────────────────
insert into departments (name, note) values
  ('Finance & Accounting', null),
  ('Development', null),
  ('Business Development', 'Michael + Vina and Jovan + Fara are linked pairs (store in each profile''s notes)'),
  ('Field Review & Video Team', 'One team — travels to all padel stores & shops to film videos and reviews.'),
  ('Content & Creative', null),
  ('Marketing, PR & SEO', null),
  ('E-commerce Operations', null);

-- ── roles: default KPI metric libraries (§5, owner-editable pick-lists) ──
insert into roles (name, kpi_rubric) values
('Admin', '[
  {"metric_key":"order_accuracy","label":"Akurasi order","description":"Order diproses tanpa kesalahan","default_target":98,"unit":"%"},
  {"metric_key":"response_time","label":"Kecepatan respon","description":"Rata-rata waktu respon chat/order","default_target":15,"unit":"menit"},
  {"metric_key":"packing_sla","label":"SLA packing","description":"Order dikemas & dikirim H+0/H+1","default_target":95,"unit":"%"},
  {"metric_key":"data_hygiene","label":"Kerapian data","description":"Stok & catatan order selalu update","default_target":100,"unit":"%"}
]'),
('Accounting', '[
  {"metric_key":"recon_timeliness","label":"Rekonsiliasi tepat waktu","description":"Rekonsiliasi bank/kas selesai sesuai jadwal","default_target":100,"unit":"%"},
  {"metric_key":"error_rate","label":"Tingkat kesalahan","description":"Kesalahan pencatatan per bulan","default_target":0,"unit":"kasus"},
  {"metric_key":"report_punctuality","label":"Laporan tepat waktu","description":"Laporan bulanan selesai sebelum tanggal 5","default_target":100,"unit":"%"}
]'),
('Purchasing', '[
  {"metric_key":"cost_saving","label":"Penghematan biaya","description":"Penghematan dibanding harga list","default_target":5,"unit":"%"},
  {"metric_key":"po_lead_time","label":"Lead time PO","description":"Rata-rata hari dari PO ke barang datang","default_target":7,"unit":"hari"},
  {"metric_key":"stockout","label":"Kejadian stockout","description":"SKU utama kehabisan stok","default_target":0,"unit":"kasus"}
]'),
('Content', '[
  {"metric_key":"posts_shipped","label":"Konten terbit","description":"Jumlah konten publish per bulan","default_target":20,"unit":"post"},
  {"metric_key":"engagement_rate","label":"Engagement rate","description":"Rata-rata ER konten bulan ini","default_target":4,"unit":"%"},
  {"metric_key":"revision_rounds","label":"Ronde revisi","description":"Rata-rata revisi per konten","default_target":1,"unit":"ronde"}
]'),
('Video Editing', '[
  {"metric_key":"videos_delivered","label":"Video selesai","description":"Video final terkirim per bulan","default_target":12,"unit":"video"},
  {"metric_key":"turnaround","label":"Turnaround","description":"Rata-rata hari dari footage ke final","default_target":3,"unit":"hari"},
  {"metric_key":"revision_rounds","label":"Ronde revisi","description":"Rata-rata revisi per video","default_target":1,"unit":"ronde"}
]'),
('PR (IG engagement)', '[
  {"metric_key":"follower_growth","label":"Pertumbuhan follower","description":"Follower baru bulan ini","default_target":1000,"unit":"follower"},
  {"metric_key":"engagement_rate","label":"Engagement rate","description":"ER akun bulan ini","default_target":5,"unit":"%"},
  {"metric_key":"collabs","label":"Kolaborasi","description":"Kolaborasi/mention berjalan","default_target":4,"unit":"kolab"}
]'),
('Sales (titip jual)', '[
  {"metric_key":"new_locations","label":"Lokasi baru","description":"Titik titip jual/konsinyasi baru","default_target":4,"unit":"lokasi"},
  {"metric_key":"sell_through","label":"Sell-through","description":"Persentase stok titipan terjual","default_target":60,"unit":"%"},
  {"metric_key":"reseller_revenue","label":"Omzet reseller","description":"Omzet channel reseller (juta Rp)","default_target":30,"unit":"jt"}
]'),
('Event Maker', '[
  {"metric_key":"events_executed","label":"Event terlaksana","description":"Event/kolaborasi muse selesai","default_target":2,"unit":"event"},
  {"metric_key":"muse_pipeline","label":"Pipeline muse","description":"Kandidat muse aktif dalam pipeline","default_target":6,"unit":"orang"},
  {"metric_key":"budget_adherence","label":"Kepatuhan budget","description":"Realisasi vs budget event","default_target":100,"unit":"%"}
]'),
('Developer', '[
  {"metric_key":"delivery","label":"Delivery","description":"Fitur/tiket selesai sesuai sprint","default_target":90,"unit":"%"},
  {"metric_key":"bug_rate","label":"Bug rate","description":"Bug produksi dari rilis bulan ini","default_target":2,"unit":"bug"},
  {"metric_key":"review_turnaround","label":"Review turnaround","description":"Rata-rata jam merespon code review","default_target":24,"unit":"jam"}
]'),
('SEO', '[
  {"metric_key":"rankings_delta","label":"Kenaikan ranking","description":"Keyword utama naik posisi","default_target":10,"unit":"keyword"},
  {"metric_key":"pages_shipped","label":"Halaman terbit","description":"Halaman/artikel SEO publish","default_target":8,"unit":"halaman"},
  {"metric_key":"backlinks","label":"Backlink","description":"Backlink baru berkualitas","default_target":5,"unit":"link"}
]');

-- ── profiles ────────────────────────────────────────────────────────
-- Entity "Both" ⇒ entity_id NULL. TBD intern types default intern_unpaid
-- (excluded from wage math). Roles marked TBD get no role_id.
do $$
declare
  nora uuid; grid uuid;
  d_fin uuid; d_dev uuid; d_biz uuid; d_frv uuid; d_cnt uuid; d_mkt uuid; d_eco uuid;
  r_admin uuid; r_acct uuid; r_purch uuid; r_content uuid; r_video uuid;
  r_pr uuid; r_sales uuid; r_event uuid; r_devl uuid; r_seo uuid;
  p_zabilla uuid; p_reva uuid;
begin
  select id into nora from entities where name = 'NoraPadel';
  select id into grid from entities where name = 'Gridline Digital';
  select id into d_fin from departments where name = 'Finance & Accounting';
  select id into d_dev from departments where name = 'Development';
  select id into d_biz from departments where name = 'Business Development';
  select id into d_frv from departments where name = 'Field Review & Video Team';
  select id into d_cnt from departments where name = 'Content & Creative';
  select id into d_mkt from departments where name = 'Marketing, PR & SEO';
  select id into d_eco from departments where name = 'E-commerce Operations';
  select id into r_admin from roles where name = 'Admin';
  select id into r_acct from roles where name = 'Accounting';
  select id into r_purch from roles where name = 'Purchasing';
  select id into r_content from roles where name = 'Content';
  select id into r_video from roles where name = 'Video Editing';
  select id into r_pr from roles where name = 'PR (IG engagement)';
  select id into r_sales from roles where name = 'Sales (titip jual)';
  select id into r_event from roles where name = 'Event Maker';
  select id into r_devl from roles where name = 'Developer';
  select id into r_seo from roles where name = 'SEO';

  -- Owner
  insert into profiles (email, full_name, entity_id, department_id, permission, badge, employment_status, notes)
  values ('cliveibrahim8@gmail.com', 'Clive Ibrahim', null, null, 'owner', 'Founder & CEO', 'active',
          'Founder & CEO — NoraPadel + Gridline Digital');

  insert into profiles (email, full_name, entity_id, department_id, role_id, badge, work_type, employment_status, intern_start, intern_end, notes) values
  ('zabilla@teamos.local',  'Zabilla',          null, d_fin, r_purch,  'Lead',     'fulltime',      'active',      null, null, 'Inventory, purchasing & accounting lead'),
  ('khofifah@teamos.local', 'Khofifah',         null, d_fin, r_acct,   null,       'fulltime',      'active',      null, null, 'Accounting'),
  ('muafi@teamos.local',    'Muafi',            null, d_dev, r_devl,   'Lead Dev', 'fulltime',      'active',      null, null, 'Leads the development team'),
  ('faul@teamos.local',     'Faul',             null, d_dev, r_devl,   null,       'fulltime',      'active',      null, null, 'Dev for NoraPadel & Gridline; sells SMMA & AI to international clients'),
  ('joe@teamos.local',      'Joe',              null, d_dev, r_devl,   'Intern',   'intern_unpaid', 'active',      null, null, 'Developer intern — period TBD (owner to correct in Settings)'),
  ('melissa@teamos.local',  'Melissa',          null, d_dev, r_devl,   'Intern',   'intern_unpaid', 'active',      null, null, 'Developer intern — period TBD (owner to correct in Settings)'),
  ('mohamad@teamos.local',  'Mohamad David',    null, d_dev, r_devl,   'Intern',   'intern_unpaid', 'not_started', '2026-07-20', '2027-01-31', 'Developer intern — Universitas Brawijaya'),
  ('jovan@teamos.local',    'Jovan',            nora, d_biz, r_sales,  null,       'fulltime',      'not_started', null, null, 'Secures locations for product placement; consignment & reseller deals. Linked pair with Fara — travels with Fara for biz-dev'),
  ('fara@teamos.local',     'Fara',             nora, d_biz, r_sales,  null,       'fulltime',      'active',      null, null, 'Assistant to Jovan — travels together for field & biz-dev'),
  ('michael@teamos.local',  'Michael Lawrence', nora, d_biz, r_sales,  null,       'fulltime',      'not_started', null, null, 'Location placement, consignment & reseller. Linked pair with Vina — travels with Vina for biz-dev'),
  ('vina@teamos.local',     'Vina',             nora, d_biz, r_sales,  null,       'fulltime',      'active',      null, null, 'Assistant to Michael Lawrence — travels together for field & biz-dev'),
  ('aisyah@teamos.local',   'Aisyah',           nora, d_frv, r_video,  null,       'fulltime',      'not_started', null, null, 'Store reviews & video'),
  ('cikal@teamos.local',    'Cikal',            nora, d_frv, r_video,  null,       'fulltime',      'not_started', null, null, 'Store reviews & video'),
  ('lovely@teamos.local',   'Lovely',           nora, d_frv, r_video,  null,       'fulltime',      'not_started', null, null, 'Store reviews & video'),
  ('suhaima@teamos.local',  'Suhaima',          nora, d_frv, r_video,  null,       'fulltime',      'active',      null, null, 'Store reviews & video'),
  ('windi@teamos.local',    'Windi',            nora, d_cnt, r_content,null,       'fulltime',      'active',      null, null, 'Live host 09–13, content creation 13–16'),
  ('refany@teamos.local',   'Refany',           nora, d_cnt, r_content,null,       'fulltime',      'not_started', null, null, 'Influencer content creation'),
  ('nadilah@teamos.local',  'Nadilah',          nora, d_cnt, r_content,'Junior',   'fulltime',      'active',      null, null, 'Junior content creation'),
  ('meita@teamos.local',    'Meita',            null, d_cnt, r_content,null,       'fulltime',      'active',      null, null, 'Graphic design'),
  ('anggita@teamos.local',  'Anggita',          nora, d_mkt, r_pr,     null,       'fulltime',      'active',      null, null, 'PR & social media'),
  ('ivana@teamos.local',    'Ivana',            nora, d_mkt, r_event,  null,       'fulltime',      'active',      null, null, 'Muse collaboration project — collab with Anggita'),
  ('diana@teamos.local',    'Diana',            grid, d_mkt, r_pr,     null,       'fulltime',      'not_started', null, null, 'PR for Gridline — sells SMMA to international clients'),
  ('luqman@teamos.local',   'Luqman',           null, d_mkt, r_seo,    null,       'fulltime',      'active',      null, null, 'SEO'),
  ('andrea@teamos.local',   'Andrea',           nora, d_mkt, null,     null,       'fulltime',      'not_started', null, null, 'Role TBD'),
  ('theodora@teamos.local', 'Theodora',         nora, d_mkt, null,     null,       'fulltime',      'not_started', null, null, 'Role TBD'),
  ('reva@teamos.local',     'Reva',             nora, d_eco, r_admin,  null,       'fulltime',      'active',      null, null, 'E-commerce admin & order packing');

  -- Known wages (acceptance #32). Everyone else: no wage row yet →
  -- appears in the Admin Dashboard "missing wage" filter.
  select id into p_zabilla from profiles where email = 'zabilla@teamos.local';
  select id into p_reva from profiles where email = 'reva@teamos.local';
  insert into wages (profile_id, monthly_wage, effective_from) values
    (p_zabilla, 1700000, '2026-07-01'),
    (p_reva,    1700000, '2026-07-01');

  -- Onboarding: bank-details task for every active employee (no bank data exists yet — all start ❌).
  insert into onboarding_tasks (profile_id, title, assignee)
  select id, 'Isi data rekening bank', 'employee'
  from profiles where employment_status = 'active' and permission <> 'owner';
end $$;

-- ── contract templates (placeholder legal text) ─────────────────────
insert into contract_templates (name, kind, body_md, merge_fields) values
('PKWT — Perjanjian Kerja Waktu Tertentu', 'pkwt',
 E'# PERJANJIAN KERJA WAKTU TERTENTU (PKWT)\n\n> **REVIEW WITH LEGAL COUNSEL** — placeholder sesuai UU Cipta Kerja.\n\nAntara **{{company_name}}** dan **{{employee_name}}** ({{role_name}}), periode {{start_date}} s/d {{end_date}}, gaji {{wage}}.\n\n1. Ruang lingkup pekerjaan …\n2. Jam kerja {{work_hours}} …\n3. Kerahasiaan …',
 '["company_name","employee_name","role_name","start_date","end_date","wage","work_hours"]'),
('PKWTT — Perjanjian Kerja Waktu Tidak Tertentu', 'pkwtt',
 E'# PERJANJIAN KERJA WAKTU TIDAK TERTENTU (PKWTT)\n\n> **REVIEW WITH LEGAL COUNSEL** — placeholder sesuai UU Cipta Kerja.\n\nAntara **{{company_name}}** dan **{{employee_name}}** ({{role_name}}), mulai {{start_date}}, gaji {{wage}}.',
 '["company_name","employee_name","role_name","start_date","wage"]'),
('Perjanjian Magang — Paid', 'intern_paid',
 E'# PERJANJIAN MAGANG (PAID)\n\n> **REVIEW WITH LEGAL COUNSEL** — magang punya aturan tersendiri (uang saku/benefit).\n\nAntara **{{company_name}}** dan **{{employee_name}}**, periode magang **{{intern_start}} s/d {{intern_end}}**, uang saku {{stipend}}.',
 '["company_name","employee_name","intern_start","intern_end","stipend"]'),
('Perjanjian Magang — Unpaid', 'intern_unpaid',
 E'# PERJANJIAN MAGANG (UNPAID)\n\n> **REVIEW WITH LEGAL COUNSEL** — magang punya aturan tersendiri (uang saku/benefit).\n\nAntara **{{company_name}}** dan **{{employee_name}}**, periode magang **{{intern_start}} s/d {{intern_end}}**.',
 '["company_name","employee_name","intern_start","intern_end"]');

-- ── onboarding template ─────────────────────────────────────────────
insert into onboarding_templates (name, tasks) values
('Standard onboarding', '[
  {"title":"Isi data rekening bank","assignee":"employee"},
  {"title":"Install TeamOS di HP (Add to Home Screen) + izinkan notifikasi","assignee":"employee"},
  {"title":"Lengkapi nomor WhatsApp di profil","assignee":"employee"},
  {"title":"Tanda tangan kontrak","assignee":"manager"},
  {"title":"Kenalan dengan tim & tour kantor","assignee":"manager"}
]');

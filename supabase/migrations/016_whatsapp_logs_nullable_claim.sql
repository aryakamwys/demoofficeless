-- 016 — whatsapp_logs.claim_id jadi nullable.
-- RAW_WEBHOOK (log payload masuk) bukan milik klaim manapun. Selama ini dipaksa
-- memakai claim_id hardcoded; begitu klaim itu terhapus (hard delete upload),
-- insert melanggar FK dan log payload gagal diam-diam — payload masuk tidak
-- meninggalkan jejak sama sekali, menyulitkan debugging alur WhatsApp.
ALTER TABLE whatsapp_logs ALTER COLUMN claim_id DROP NOT NULL;

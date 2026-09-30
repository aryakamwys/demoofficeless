-- ============================================================
-- 016: Bersih-bersih log WA
-- Log RAW_WEBHOOK dulunya dicatat dengan claim_id hardcode (UUID palsu)
-- — record yatim yang aneh di data. Kolom dibuat nullable supaya log
-- sistem (tanpa klaim) tidak butuh id palsu, lalu sampahnya dihapus.
-- ============================================================

ALTER TABLE whatsapp_logs ALTER COLUMN claim_id DROP NOT NULL;

DELETE FROM whatsapp_logs
WHERE claim_id = '1aedea14-57ef-4929-8d27-f6b8b513cbe0'
  AND message_type = 'RAW_WEBHOOK';

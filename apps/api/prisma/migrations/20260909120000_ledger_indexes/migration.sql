CREATE INDEX "entries_user_id_deleted_at_entry_date_idx" ON "entries"("user_id", "deleted_at", "entry_date");
CREATE INDEX "entries_user_id_book_id_deleted_at_entry_date_idx" ON "entries"("user_id", "book_id", "deleted_at", "entry_date");
CREATE INDEX "entries_transfer_id_idx" ON "entries"("transfer_id");
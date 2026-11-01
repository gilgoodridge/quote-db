package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.gilgood.search.QuoteSearchText;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class V4__backfill_quote_search_text extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws SQLException {
        try (var select = context.getConnection().prepareStatement(
                "SELECT id, text FROM quotes WHERE id > ? ORDER BY id LIMIT 500");
             var update = context.getConnection().prepareStatement(
                     "UPDATE quotes SET search_text = ? WHERE id = ?")) {
            long lastId = Long.MIN_VALUE;
            while (true) {
                select.setLong(1, lastId);
                List<QuoteRow> rows = new ArrayList<>();
                try (var results = select.executeQuery()) {
                    while (results.next()) {
                        rows.add(new QuoteRow(results.getLong("id"), results.getString("text")));
                    }
                }
                if (rows.isEmpty()) return;
                for (QuoteRow row : rows) {
                    update.setString(1, QuoteSearchText.normalize(row.text()));
                    update.setLong(2, row.id());
                    update.addBatch();
                }
                update.executeBatch();
                update.clearBatch();
                lastId = rows.getLast().id();
            }
        }
    }

    private record QuoteRow(long id, String text) {
    }
}

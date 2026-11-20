export function createEsiMarketCorporationDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS esi_market_corporation_authorisations (
      character_id INTEGER PRIMARY KEY,
      character_name TEXT NOT NULL,
      corporation_id INTEGER NOT NULL,
      corporation_name TEXT NOT NULL,
      encrypted_refresh_token TEXT NOT NULL,
      linked_at TEXT NOT NULL
    )
  `);

  const list = db.prepare(`
    SELECT
      character_id AS characterId,
      character_name AS characterName,
      corporation_id AS corporationId,
      corporation_name AS corporationName,
      linked_at AS linkedAt
    FROM esi_market_corporation_authorisations
    ORDER BY corporation_name COLLATE NOCASE, character_name COLLATE NOCASE
  `);

  const get = db.prepare(`
    SELECT
      character_id AS characterId,
      corporation_id AS corporationId,
      encrypted_refresh_token AS encryptedRefreshToken,
      linked_at AS linkedAt
    FROM esi_market_corporation_authorisations
    WHERE character_id = ?
  `);

  const save = db.prepare(`
    INSERT INTO esi_market_corporation_authorisations (
      character_id,
      character_name,
      corporation_id,
      corporation_name,
      encrypted_refresh_token,
      linked_at
    ) VALUES (
      @characterId,
      @characterName,
      @corporationId,
      @corporationName,
      @encryptedRefreshToken,
      @linkedAt
    )
    ON CONFLICT (character_id) DO UPDATE SET
      character_name = excluded.character_name,
      corporation_id = excluded.corporation_id,
      corporation_name = excluded.corporation_name,
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      linked_at = excluded.linked_at
  `);

  const updateRefreshToken = db.prepare(`
    UPDATE esi_market_corporation_authorisations
    SET encrypted_refresh_token = @nextEncryptedRefreshToken
    WHERE character_id = @characterId
      AND corporation_id = @corporationId
      AND linked_at = @linkedAt
      AND encrypted_refresh_token = @encryptedRefreshToken
  `);

  const remove = db.prepare(`
    DELETE FROM esi_market_corporation_authorisations
    WHERE character_id = ?
  `);

  return {
    listAuthorisations() {
      return list.all();
    },

    getAuthorisation(characterId) {
      return get.get(characterId) ?? null;
    },

    saveAuthorisation({
      characterId,
      characterName,
      corporationId,
      corporationName,
      encryptedRefreshToken,
    }) {
      save.run({
        characterId,
        characterName,
        corporationId,
        corporationName,
        encryptedRefreshToken,
        linkedAt: new Date().toISOString(),
      });
    },

    replaceRefreshToken(authorisation, nextEncryptedRefreshToken) {
      return updateRefreshToken.run({
        ...authorisation,
        nextEncryptedRefreshToken,
      }).changes === 1;
    },

    unlinkAuthorisation(characterId) {
      return remove.run(characterId).changes === 1;
    },
  };
}
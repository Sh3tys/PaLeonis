const pool = require("../db");

class Datacenter {
  static async findAll() {
    const { rows } = await pool.query(
      "SELECT id, nom, ville FROM datacenter ORDER BY id",
    );
    return rows;
  }

  static async findById(id) {
    const { rows } = await pool.query(
      "SELECT id, nom, ville FROM datacenter WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  }
}

module.exports = Datacenter;

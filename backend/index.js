const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host:  'localhost',
  user:  'postgres',
  database:  'postgres',
  password:  '1234',
  port:  5432,
  options: '-c search_path=oriontour',
});

async function initDb() {
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_tour_title_country
    ON tour (title, country_id);
  `);
}

initDb().then(() => {
  console.log('DB initialized');
}).catch((e) => {
  console.error('DB init error:', e);
  process.exit(1);
});



app.post('/admin/login', (req, res) => {
  const { login, password } = req.body;
  if (login === 'admin' && password === 'admin') return res.json({ success: true });
  return res.status(401).json({ success: false, message: 'Неверные данные' });
});

app.get('/admin/countries', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT *
      FROM globe_markers
      ORDER BY popularity_score DESC, name_ru ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка получения стран' });
  }
});

app.post('/admin/countries', async (req, res) => {
  try {
    const { name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score } = req.body;

    const { rows } = await pool.query(`
      INSERT INTO country (name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (iso_code) DO UPDATE SET
        name_ru = EXCLUDED.name_ru,
        name_en = EXCLUDED.name_en,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        flag_url = EXCLUDED.flag_url,
        is_popular = EXCLUDED.is_popular,
        popularity_score = EXCLUDED.popularity_score
      RETURNING *
    `, [name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score]);

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка добавления/обновления страны' });
  }
});

app.put('/admin/countries/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score } = req.body;

    const { rows } = await pool.query(`
      UPDATE country SET
        name_ru=$1, name_en=$2, iso_code=$3, lat=$4, lng=$5,
        flag_url=$6, is_popular=$7, popularity_score=$8
      WHERE id=$9
      RETURNING *
    `, [name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score, id]);

    if (!rows[0]) return res.status(404).json({ message: 'Страна не найдена' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка обновления страны' });
  }
});

app.delete('/admin/countries/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(`DELETE FROM country WHERE id=$1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Страна не найдена' });
    res.sendStatus(204);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка удаления страны' });
  }
});

app.get('/admin/tours', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        t.id,
        t.title,
        t.short_desc,
        t.image_url,
        t.is_hot,
        t.country_id,
        c.name_ru AS country_name,

        -- цена "от" только по доступным офферам
        COALESCE(MIN(o.price) FILTER (WHERE o.is_available = TRUE), 0) AS price_from,

        -- рейтинг: средний рейтинг отелей, встречающихся в офферах тура
        COALESCE(AVG(hl.rating_avg) FILTER (WHERE o.is_available = TRUE), 0)::numeric(3,1) AS rating_avg,

        -- сколько доступных офферов у тура
        COUNT(o.id) FILTER (WHERE o.is_available = TRUE) AS offers_count
      FROM tour t
      JOIN country c ON c.id = t.country_id
      LEFT JOIN tour_offer o ON o.tour_id = t.id
      LEFT JOIN hotel_listing hl ON hl.hotel_id = o.hotel_id
      GROUP BY t.id, c.name_ru
      ORDER BY t.id DESC
    `);

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка получения туров' });
  }
});

app.post('/admin/tours', async (req, res) => {
  try {
    const { title, short_desc, country_id, image_url, is_hot } = req.body;

    const { rows } = await pool.query(`
      INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (title, country_id) DO UPDATE SET
        short_desc = EXCLUDED.short_desc,
        image_url = EXCLUDED.image_url,
        is_hot = EXCLUDED.is_hot
      RETURNING *
    `, [title, short_desc, country_id, image_url, is_hot]);

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка добавления/обновления тура' });
  }
});

app.put('/admin/tours/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, short_desc, country_id, image_url, is_hot } = req.body;

    const { rows } = await pool.query(`
      UPDATE tour SET
        title=$1, short_desc=$2, country_id=$3, image_url=$4, is_hot=$5
      WHERE id=$6
      RETURNING *
    `, [title, short_desc, country_id, image_url, is_hot, id]);

    if (!rows[0]) return res.status(404).json({ message: 'Тур не найден' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка обновления тура' });
  }
});

app.delete('/admin/tours/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(`DELETE FROM tour WHERE id=$1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Тур не найден' });
    res.sendStatus(204);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка удаления тура' });
  }
});

app.get('/admin/hotels', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        h.id,
        h.name,
        h.stars,
        h.address,
        h.lat,
        h.lng,
        h.description,
        h.country_id,
        c.name_ru AS country_name,
        h.resort_id,
        rs.name_ru AS resort_name,

        hl.price_from,
        hl.preview_image_url,
        hl.rating_avg,
        hl.reviews_count,
        hl.offers_count
      FROM hotel h
      JOIN country c ON c.id = h.country_id
      LEFT JOIN resort rs ON rs.id = h.resort_id
      LEFT JOIN hotel_listing hl ON hl.hotel_id = h.id
      ORDER BY h.id DESC
    `);

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка получения отелей' });
  }
});

app.post('/admin/hotels', async (req, res) => {
  try {
    const { country_id, resort_id, name, stars, address, lat, lng, description } = req.body;

    const { rows } = await pool.query(`
      INSERT INTO hotel (country_id, resort_id, name, stars, address, lat, lng, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (country_id, name) DO UPDATE SET
        resort_id = EXCLUDED.resort_id,
        stars = EXCLUDED.stars,
        address = EXCLUDED.address,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        description = EXCLUDED.description
      RETURNING *
    `, [country_id, resort_id ?? null, name, stars ?? null, address ?? null, lat ?? null, lng ?? null, description ?? null]);

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка добавления/обновления отеля' });
  }
});

app.put('/admin/hotels/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { country_id, resort_id, name, stars, address, lat, lng, description } = req.body;

    const { rows } = await pool.query(`
      UPDATE hotel SET
        country_id=$1,
        resort_id=$2,
        name=$3,
        stars=$4,
        address=$5,
        lat=$6,
        lng=$7,
        description=$8
      WHERE id=$9
      RETURNING *
    `, [country_id, resort_id ?? null, name, stars ?? null, address ?? null, lat ?? null, lng ?? null, description ?? null, id]);

    if (!rows[0]) return res.status(404).json({ message: 'Отель не найден' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка обновления отеля' });
  }
});

app.delete('/admin/hotels/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(`DELETE FROM hotel WHERE id=$1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Отель не найден' });
    res.sendStatus(204);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка удаления отеля' });
  }
});

app.get('/admin/offers', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        o.id,
        o.tour_id,
        t.title AS tour_title,

        o.hotel_id,
        h.name AS hotel_name,

        o.departure_city_id,
        dc.name_ru AS departure_city_name,

        o.start_date,
        o.nights,
        o.meal_plan_id,
        mp.code AS meal_plan_code,

        o.price,
        o.currency_code,
        o.includes_flight,
        o.is_available,
        o.available_seats,
        o.hotel_stars_cached
      FROM tour_offer o
      JOIN hotel h ON h.id = o.hotel_id
      JOIN departure_city dc ON dc.id = o.departure_city_id
      LEFT JOIN meal_plan mp ON mp.id = o.meal_plan_id
      LEFT JOIN tour t ON t.id = o.tour_id
      ORDER BY o.start_date DESC, o.id DESC
    `);

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка получения офферов' });
  }
});

app.post('/admin/offers', async (req, res) => {
  try {
    const {
      tour_id,
      hotel_id,
      departure_city_id,
      start_date,
      nights,
      meal_plan_id,
      price,
      currency_code,
      includes_flight,
      is_available,
      available_seats,
    } = req.body;

    const { rows } = await pool.query(`
      INSERT INTO tour_offer (
        tour_id, hotel_id, departure_city_id,
        start_date, nights, meal_plan_id,
        price, currency_code, includes_flight,
        is_available, available_seats, hotel_stars_cached
      )
      SELECT
        $1, $2, $3,
        $4::date, $5, $6,
        $7, $8::char(3), $9,
        $10, $11, h.stars
      FROM hotel h
      WHERE h.id = $2
      ON CONFLICT ON CONSTRAINT uq_offer_key DO UPDATE SET
        tour_id = EXCLUDED.tour_id,
        price = EXCLUDED.price,
        is_available = EXCLUDED.is_available,
        available_seats = EXCLUDED.available_seats,
        hotel_stars_cached = EXCLUDED.hotel_stars_cached
      RETURNING *
    `, [
      tour_id ?? null,
      hotel_id,
      departure_city_id,
      start_date,
      nights,
      meal_plan_id ?? null,
      price,
      currency_code,
      includes_flight ?? true,
      is_available ?? true,
      available_seats ?? null,
    ]);

    if (!rows[0]) return res.status(400).json({ message: 'Отель не найден (hotel_id)' });
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка добавления/обновления оффера' });
  }
});

app.delete('/admin/offers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(`DELETE FROM tour_offer WHERE id=$1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Оффер не найден' });
    res.sendStatus(204);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка удаления оффера' });
  }
});

app.get('/admin/meta', async (req, res) => {
  try {
    const [countries, resorts, departureCities, mealPlans, currencies] = await Promise.all([
      pool.query(`SELECT id, name_ru, iso_code FROM country ORDER BY name_ru`),
      pool.query(`SELECT id, name_ru, country_id FROM resort ORDER BY name_ru`),
      pool.query(`SELECT id, name_ru FROM departure_city WHERE is_active=TRUE ORDER BY name_ru`),
      pool.query(`SELECT id, code, name_ru FROM meal_plan ORDER BY code`),
      pool.query(`SELECT code, name_ru, symbol FROM currency ORDER BY code`),
    ]);

    res.json({
      countries: countries.rows,
      resorts: resorts.rows,
      departureCities: departureCities.rows,
      mealPlans: mealPlans.rows,
      currencies: currencies.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка получения справочников' });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));

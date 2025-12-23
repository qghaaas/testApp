
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  password: process.env.PGPASSWORD || '1234',
  port: Number(process.env.PGPORT || 5432),
  options: process.env.PGOPTIONS || '-c search_path=oriontour',
})

async function initDb() {
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_tour_title_country
    ON tour (title, country_id);
  `)
}
initDb()
  .then(() => console.log('DB initialized'))
  .catch((e) => {
    console.error('DB init error:', e)
    process.exit(1)
  })

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev_secret'

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: '12h' })
}

function requireAdmin(req, res, next) {
  const hdr = req.headers.authorization || ''
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Нет токена' })

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET)
    if (payload?.role !== 'admin') return res.status(403).json({ message: 'Нет доступа' })
    req.admin = payload
    next()
  } catch (e) {
    return res.status(401).json({ message: 'Токен недействителен' })
  }
}

async function q(sql, params) {
  const { rows } = await pool.query(sql, params)
  return rows
}

function toInt(v, def = null) {
  if (v === undefined || v === null || v === '') return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function toBool(v, def = false) {
  if (v === undefined || v === null) return def
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v.toLowerCase() === 'true'
  return Boolean(v)
}

app.post('/admin/login', (req, res) => {
  const { login, password } = req.body || {}
  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    return res.json({ token: signAdminToken() })
  }
  return res.status(401).json({ message: 'Неверные данные' })
})

app.use('/admin', requireAdmin)

app.get('/admin/countries', async (req, res, next) => {
  try {
    const rows = await q(
      `
      SELECT *
      FROM globe_markers
      ORDER BY popularity_score DESC, name_ru ASC
    `
    )
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

app.post('/admin/countries', async (req, res, next) => {
  try {
    const b = req.body || {}
    const rows = await q(
      `
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
    `,
      [
        b.name_ru,
        b.name_en,
        b.iso_code,
        Number(b.lat),
        Number(b.lng),
        b.flag_url || null,
        toBool(b.is_popular, false),
        toInt(b.popularity_score, 0),
      ]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    next(e)
  }
})

app.put('/admin/countries/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const b = req.body || {}

    const rows = await q(
      `
      UPDATE country SET
        name_ru=$1, name_en=$2, iso_code=$3, lat=$4, lng=$5,
        flag_url=$6, is_popular=$7, popularity_score=$8
      WHERE id=$9
      RETURNING *
    `,
      [
        b.name_ru,
        b.name_en,
        b.iso_code,
        Number(b.lat),
        Number(b.lng),
        b.flag_url || null,
        toBool(b.is_popular, false),
        toInt(b.popularity_score, 0),
        id,
      ]
    )

    if (!rows[0]) return res.status(404).json({ message: 'Страна не найдена' })
    res.json(rows[0])
  } catch (e) {
    next(e)
  }
})

app.delete('/admin/countries/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const r = await pool.query(`DELETE FROM country WHERE id=$1`, [id])
    if (r.rowCount === 0) return res.status(404).json({ message: 'Страна не найдена' })
    res.sendStatus(204)
  } catch (e) {
    next(e)
  }
})

app.get('/admin/tours', async (req, res, next) => {
  try {
    const rows = await q(
      `
      SELECT
        t.id,
        t.title,
        t.short_desc,
        t.image_url,
        t.is_hot,
        t.country_id,
        c.name_ru AS country_name,

        COALESCE(MIN(o.price) FILTER (WHERE o.is_available = TRUE), 0) AS price_from,
        COALESCE(AVG(hl.rating_avg) FILTER (WHERE o.is_available = TRUE), 0)::numeric(3,1) AS rating_avg,
        COUNT(o.id) FILTER (WHERE o.is_available = TRUE) AS offers_count
      FROM tour t
      JOIN country c ON c.id = t.country_id
      LEFT JOIN tour_offer o ON o.tour_id = t.id
      LEFT JOIN hotel_listing hl ON hl.hotel_id = o.hotel_id
      GROUP BY t.id, c.name_ru
      ORDER BY t.id DESC
    `
    )
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

app.get('/admin/tours/options', async (req, res, next) => {
  try {
    const countryId = toInt(req.query.country_id, null)
    const qText = String(req.query.q || '').trim()
    const limit = Math.min(toInt(req.query.limit, 50) || 50, 200)

    const params = []
    let where = 'WHERE 1=1'

    if (countryId) {
      params.push(countryId)
      where += ` AND country_id = $${params.length}`
    }

    if (qText) {
      params.push(`%${qText.toLowerCase()}%`)
      where += ` AND LOWER(title) LIKE $${params.length}`
    }

    params.push(limit)

    const rows = await q(
      `
      SELECT id, title, country_id
      FROM tour
      ${where}
      ORDER BY id DESC
      LIMIT $${params.length}
    `,
      params
    )

    res.json(rows)
  } catch (e) {
    next(e)
  }
})

app.post('/admin/tours', async (req, res, next) => {
  try {
    const b = req.body || {}

    const rows = await q(
      `
      INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (title, country_id) DO UPDATE SET
        short_desc = EXCLUDED.short_desc,
        image_url = EXCLUDED.image_url,
        is_hot = EXCLUDED.is_hot
      RETURNING *
    `,
      [b.title, b.short_desc || null, Number(b.country_id), b.image_url || null, toBool(b.is_hot, false)]
    )

    res.status(201).json(rows[0])
  } catch (e) {
    next(e)
  }
})

app.put('/admin/tours/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const b = req.body || {}

    const rows = await q(
      `
      UPDATE tour SET
        title=$1, short_desc=$2, country_id=$3, image_url=$4, is_hot=$5
      WHERE id=$6
      RETURNING *
    `,
      [b.title, b.short_desc || null, Number(b.country_id), b.image_url || null, toBool(b.is_hot, false), id]
    )

    if (!rows[0]) return res.status(404).json({ message: 'Тур не найден' })
    res.json(rows[0])
  } catch (e) {
    next(e)
  }
})

app.delete('/admin/tours/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const r = await pool.query(`DELETE FROM tour WHERE id=$1`, [id])
    if (r.rowCount === 0) return res.status(404).json({ message: 'Тур не найден' })
    res.sendStatus(204)
  } catch (e) {
    next(e)
  }
})


app.get('/admin/hotels', async (req, res, next) => {
  try {
    const rows = await q(
      `
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
    `
    )
    res.json(rows)
  } catch (e) {
    next(e)
  }
})


app.get('/admin/hotels/options', async (req, res, next) => {
  try {
    const countryId = toInt(req.query.country_id, null)
    const qText = String(req.query.q || '').trim()
    const limit = Math.min(toInt(req.query.limit, 50) || 50, 200)

    const params = []
    let where = 'WHERE 1=1'

    if (countryId) {
      params.push(countryId)
      where += ` AND country_id = $${params.length}`
    }

    if (qText) {
      params.push(`%${qText.toLowerCase()}%`)
      where += ` AND LOWER(name) LIKE $${params.length}`
    }

    params.push(limit)

    const rows = await q(
      `
      SELECT id, name, country_id, resort_id, stars
      FROM hotel
      ${where}
      ORDER BY id DESC
      LIMIT $${params.length}
    `,
      params
    )

    res.json(rows)
  } catch (e) {
    next(e)
  }
})

app.post('/admin/hotels', async (req, res, next) => {
  try {
    const b = req.body || {}

    const rows = await q(
      `
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
    `,
      [
        Number(b.country_id),
        b.resort_id ?? null,
        b.name,
        b.stars ?? null,
        b.address ?? null,
        b.lat ?? null,
        b.lng ?? null,
        b.description ?? null,
      ]
    )

    res.status(201).json(rows[0])
  } catch (e) {
    next(e)
  }
})

app.put('/admin/hotels/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const b = req.body || {}

    const rows = await q(
      `
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
    `,
      [
        Number(b.country_id),
        b.resort_id ?? null,
        b.name,
        b.stars ?? null,
        b.address ?? null,
        b.lat ?? null,
        b.lng ?? null,
        b.description ?? null,
        id,
      ]
    )

    if (!rows[0]) return res.status(404).json({ message: 'Отель не найден' })
    res.json(rows[0])
  } catch (e) {
    next(e)
  }
})

app.delete('/admin/hotels/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const r = await pool.query(`DELETE FROM hotel WHERE id=$1`, [id])
    if (r.rowCount === 0) return res.status(404).json({ message: 'Отель не найден' })
    res.sendStatus(204)
  } catch (e) {
    next(e)
  }
})

app.get('/admin/hotels/:id/images', async (req, res, next) => {
  try {
    const hotelId = Number(req.params.id)
    const rows = await q(
      `
      SELECT id, hotel_id, url, sort_order, created_at
      FROM hotel_image
      WHERE hotel_id=$1
      ORDER BY sort_order, id
    `,
      [hotelId]
    )
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

app.post('/admin/hotels/:id/images', async (req, res, next) => {
  try {
    const hotelId = Number(req.params.id)
    const { url, sort_order } = req.body || {}
    const rows = await q(
      `
      INSERT INTO hotel_image (hotel_id, url, sort_order)
      VALUES ($1,$2,$3)
      ON CONFLICT (hotel_id, url) DO UPDATE SET sort_order = EXCLUDED.sort_order
      RETURNING *
    `,
      [hotelId, url, toInt(sort_order, 0)]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    next(e)
  }
})

app.delete('/admin/hotel-images/:imageId', async (req, res, next) => {
  try {
    const imageId = Number(req.params.imageId)
    const r = await pool.query(`DELETE FROM hotel_image WHERE id=$1`, [imageId])
    if (!r.rowCount) return res.status(404).json({ message: 'Фото не найдено' })
    res.sendStatus(204)
  } catch (e) {
    next(e)
  }
})

app.get('/admin/offers', async (req, res, next) => {
  try {
    const rows = await q(
      `
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
    `
    )

    res.json(rows)
  } catch (e) {
    next(e)
  }
})

app.post('/admin/offers', async (req, res, next) => {
  try {
    const b = req.body || {}

    const rows = await q(
      `
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
    `,
      [
        b.tour_id ?? null,
        Number(b.hotel_id),
        Number(b.departure_city_id),
        b.start_date,
        Number(b.nights),
        b.meal_plan_id ?? null,
        Number(b.price),
        String(b.currency_code || 'EUR'),
        toBool(b.includes_flight, true),
        toBool(b.is_available, true),
        b.available_seats ?? null,
      ]
    )

    if (!rows[0]) return res.status(400).json({ message: 'Отель не найден (hotel_id)' })
    res.status(201).json(rows[0])
  } catch (e) {
    next(e)
  }
})

app.delete('/admin/offers/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const r = await pool.query(`DELETE FROM tour_offer WHERE id=$1`, [id])
    if (r.rowCount === 0) return res.status(404).json({ message: 'Оффер не найден' })
    res.sendStatus(204)
  } catch (e) {
    next(e)
  }
})

app.patch('/admin/offers/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const b = req.body || {}

    const price = b.price !== undefined ? Number(b.price) : undefined
    const is_available = b.is_available !== undefined ? toBool(b.is_available, true) : undefined
    const available_seats = b.available_seats !== undefined ? (b.available_seats === null ? null : Number(b.available_seats)) : undefined

    const set = []
    const params = []
    if (price !== undefined) { params.push(price); set.push(`price=$${params.length}`) }
    if (is_available !== undefined) { params.push(is_available); set.push(`is_available=$${params.length}`) }
    if (available_seats !== undefined) { params.push(available_seats); set.push(`available_seats=$${params.length}`) }

    if (!set.length) return res.status(400).json({ message: 'Нет полей для обновления' })

    params.push(id)

    const rows = await q(
      `
      UPDATE tour_offer
      SET ${set.join(', ')}
      WHERE id=$${params.length}
      RETURNING *
    `,
      params
    )

    if (!rows[0]) return res.status(404).json({ message: 'Оффер не найден' })
    res.json(rows[0])
  } catch (e) {
    next(e)
  }
})

app.get('/admin/meta', async (req, res, next) => {
  try {
    const [countries, resorts, departureCities, mealPlans, currencies] = await Promise.all([
      pool.query(`SELECT id, name_ru, iso_code FROM country ORDER BY name_ru`),
      pool.query(`SELECT id, name_ru, country_id FROM resort ORDER BY name_ru`),
      pool.query(`SELECT id, name_ru FROM departure_city WHERE is_active=TRUE ORDER BY name_ru`),
      pool.query(`SELECT id, code, name_ru FROM meal_plan ORDER BY code`),
      pool.query(`SELECT code, name_ru, symbol FROM currency ORDER BY code`),
    ])

    res.json({
      countries: countries.rows,
      resorts: resorts.rows,
      departureCities: departureCities.rows,
      mealPlans: mealPlans.rows,
      currencies: currencies.rows,
    })
  } catch (e) {
    next(e)
  }
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ message: 'Server error' })
})

app.listen(port, () => console.log(`Server running on port ${port}`))

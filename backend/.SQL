SET search_path TO oriontour;


CREATE table country (
  id               BIGSERIAL PRIMARY KEY,
  name_ru          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  iso_code         CHAR(2) NOT NULL UNIQUE,
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  flag_url         TEXT,
  is_popular       BOOLEAN NOT NULL DEFAULT FALSE,
  popularity_score INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE table region (
  id         BIGSERIAL PRIMARY KEY,
  country_id BIGINT NOT NULL REFERENCES country(id) ON DELETE CASCADE,
  name_ru    TEXT NOT NULL,
  name_en    TEXT,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_id, name_ru)
);

CREATE table resort (
  id         BIGSERIAL PRIMARY KEY,
  country_id BIGINT NOT NULL REFERENCES country(id) ON DELETE CASCADE,
  region_id  BIGINT REFERENCES region(id) ON DELETE SET NULL,
  name_ru    TEXT NOT NULL,
  name_en    TEXT,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_id, name_ru)
);

CREATE index idx_region_country ON region(country_id);
CREATE index idx_resort_country ON resort(country_id);
CREATE index idx_resort_region  ON resort(region_id);


CREATE table departure_city (
  id         BIGSERIAL PRIMARY KEY,
  name_ru    TEXT NOT NULL,
  name_en    TEXT,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name_ru)
);


CREATE table hotel (
  id          BIGSERIAL PRIMARY KEY,
  country_id  BIGINT NOT NULL REFERENCES country(id) ON DELETE CASCADE,
  resort_id   BIGINT REFERENCES resort(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  stars       SMALLINT CHECK (stars BETWEEN 1 AND 5),
  address     TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_id, name)
);

CREATE table hotel_image (
  id         BIGSERIAL PRIMARY KEY,
  hotel_id   BIGINT NOT NULL REFERENCES hotel(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_hotel_image UNIQUE (hotel_id, url)
);

CREATE index idx_hotel_country     ON hotel(country_id);
CREATE index idx_hotel_resort      ON hotel(resort_id);
CREATE index idx_hotel_image_hotel ON hotel_image(hotel_id);


CREATE table meal_plan (
  id      BIGSERIAL PRIMARY KEY,
  code    TEXT NOT NULL UNIQUE,  -- RO, BB, HB, FB, AI, UAI
  name_ru TEXT NOT NULL,
  name_en TEXT
);


CREATE table currency (
  code    CHAR(3) PRIMARY KEY,   -- RUB, USD, EUR
  name_ru TEXT NOT NULL,
  symbol  TEXT
);


CREATE table tour (
  id         BIGSERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  short_desc TEXT,
  country_id BIGINT NOT NULL REFERENCES country(id) ON DELETE CASCADE,
  image_url  TEXT,
  is_hot     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE index idx_tour_country ON tour(country_id);


CREATE table tour_offer (
  id                BIGSERIAL PRIMARY KEY,
  tour_id           BIGINT REFERENCES tour(id) ON DELETE SET NULL,
  hotel_id          BIGINT NOT NULL REFERENCES hotel(id) ON DELETE CASCADE,
  departure_city_id BIGINT NOT NULL REFERENCES departure_city(id) ON DELETE RESTRICT,

  start_date        DATE NOT NULL,
  nights            SMALLINT NOT NULL CHECK (nights BETWEEN 1 AND 60),
  meal_plan_id      BIGINT REFERENCES meal_plan(id) ON DELETE SET NULL,

  price             NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  currency_code     CHAR(3) NOT NULL REFERENCES currency(code),

  includes_flight   BOOLEAN NOT NULL DEFAULT TRUE,
  is_available      BOOLEAN NOT NULL DEFAULT TRUE,
  available_seats   INTEGER,

  hotel_stars_cached SMALLINT, 

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_offer_key UNIQUE
    (hotel_id, departure_city_id, start_date, nights, meal_plan_id, includes_flight, currency_code)
);

COMMENT ON TABLE tour_offer IS
'Конкретное предложение: отель + вылет + дата + ночи + питание + цена + наличие (главная таблица для фильтров/поиска).';

CREATE index idx_offer_filter_main ON tour_offer(departure_city_id, start_date, nights, includes_flight, is_available);
CREATE index idx_offer_hotel        ON tour_offer(hotel_id);
CREATE index idx_offer_meal         ON tour_offer(meal_plan_id);
CREATE index idx_offer_price        ON tour_offer(price);
CREATE index idx_offer_currency     ON tour_offer(currency_code);



CREATE table review (
  id          BIGSERIAL PRIMARY KEY,
  hotel_id    BIGINT NOT NULL REFERENCES hotel(id) ON DELETE CASCADE,
  author_name TEXT,
  rating      NUMERIC(2,1) NOT NULL CHECK (rating BETWEEN 0 AND 5),
  text        TEXT,
  source      TEXT, -- 'site', 'import', 'instagram' и т.п.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE table review_image (
  id         BIGSERIAL PRIMARY KEY,
  review_id  BIGINT NOT NULL REFERENCES review(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_review_image UNIQUE (review_id, url)
);

CREATE index idx_review_hotel ON review(hotel_id);


CREATE table contact_message (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT,
  phone      TEXT,
  email      TEXT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','closed'))
);


CREATE OR REPLACE VIEW globe_markers AS
SELECT
  c.id, c.name_ru, c.name_en, c.iso_code, c.lat, c.lng, c.flag_url,
  c.is_popular, c.popularity_score,
  COALESCE(COUNT(DISTINCT h.id), 0) AS hotels_count,
  COALESCE(COUNT(o.id), 0) AS offers_count
FROM country c
LEFT JOIN hotel h ON h.country_id = c.id
LEFT JOIN tour_offer o ON o.hotel_id = h.id
GROUP BY
  c.id, c.name_ru, c.name_en, c.iso_code, c.lat, c.lng, c.flag_url,
  c.is_popular, c.popularity_score;


CREATE OR REPLACE VIEW hotel_listing AS
SELECT
  h.id AS hotel_id,
  h.name,
  h.stars,
  h.country_id,
  h.resort_id,
  MIN(o.price) AS price_from,
  (
    SELECT hi.url
    FROM hotel_image hi
    WHERE hi.hotel_id = h.id
    ORDER BY hi.sort_order, hi.id
    LIMIT 1
  ) AS preview_image_url,
  COALESCE(AVG(r.rating), 0) AS rating_avg,
  COUNT(r.id) AS reviews_count,
  COUNT(o.id) AS offers_count
FROM hotel h
LEFT JOIN tour_offer o ON o.hotel_id = h.id AND o.is_available = TRUE
LEFT JOIN review r ON r.hotel_id = h.id
GROUP BY h.id;


CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_country_updated') THEN
    CREATE TRIGGER tr_country_updated
    BEFORE UPDATE ON country
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_region_updated') THEN
    CREATE TRIGGER tr_region_updated
    BEFORE UPDATE ON region
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_resort_updated') THEN
    CREATE TRIGGER tr_resort_updated
    BEFORE UPDATE ON resort
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_departure_city_updated') THEN
    CREATE TRIGGER tr_departure_city_updated
    BEFORE UPDATE ON departure_city
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_hotel_updated') THEN
    CREATE TRIGGER tr_hotel_updated
    BEFORE UPDATE ON hotel
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_tour_updated') THEN
    CREATE TRIGGER tr_tour_updated
    BEFORE UPDATE ON tour
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_offer_updated') THEN
    CREATE TRIGGER tr_offer_updated
    BEFORE UPDATE ON tour_offer
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;



INSERT INTO currency(code, name_ru, symbol)
VALUES
  ('RUB','Российский рубль','₽'),
  ('USD','Доллар США','$'),
  ('EUR','Евро','€')
ON CONFLICT (code) DO NOTHING;

INSERT INTO meal_plan(code, name_ru)
VALUES
  ('RO','Только проживание'),
  ('BB','Завтраки'),
  ('HB','Полупансион'),
  ('FB','Полный пансион'),
  ('AI','Всё включено'),
  ('UAI','Ультра всё включено')
ON CONFLICT (code) DO NOTHING;

INSERT INTO country (name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score)
VALUES
  ('Турция', 'Turkey', 'TR', 38.9637, 35.2433, 'https://flagcdn.com/w80/tr.png', TRUE, 100),
  ('Египет', 'Egypt', 'EG', 26.8206, 30.8025, 'https://flagcdn.com/w80/eg.png', TRUE, 90),
  ('ОАЭ', 'United Arab Emirates', 'AE', 23.4241, 53.8478, 'https://flagcdn.com/w80/ae.png', TRUE, 70),
  ('Таиланд', 'Thailand', 'TH', 15.8700, 100.9925, 'https://flagcdn.com/w80/th.png', TRUE, 65),

  ('Вьетнам', 'Vietnam', 'VN', 14.0583, 108.2772, 'https://flagcdn.com/w80/vn.png', TRUE, 60),
  ('Индонезия', 'Indonesia', 'ID', -0.7893, 113.9213, 'https://flagcdn.com/w80/id.png', TRUE, 58),
  ('Индия', 'India', 'IN', 20.5937, 78.9629, 'https://flagcdn.com/w80/in.png', FALSE, 45),
  ('Китай', 'China', 'CN', 35.8617, 104.1954, 'https://flagcdn.com/w80/cn.png', FALSE, 50),

  ('Испания', 'Spain', 'ES', 40.4637, -3.7492, 'https://flagcdn.com/w80/es.png', TRUE, 75),
  ('Италия', 'Italy', 'IT', 41.8719, 12.5674, 'https://flagcdn.com/w80/it.png', TRUE, 80),
  ('Франция', 'France', 'FR', 46.2276, 2.2137, 'https://flagcdn.com/w80/fr.png', TRUE, 78),
  ('Греция', 'Greece', 'GR', 39.0742, 21.8243, 'https://flagcdn.com/w80/gr.png', TRUE, 72),

  ('Мальдивы', 'Maldives', 'MV', 3.2028, 73.2207, 'https://flagcdn.com/w80/mv.png', TRUE, 68),
  ('Сейшелы', 'Seychelles', 'SC', -4.6796, 55.4920, 'https://flagcdn.com/w80/sc.png', FALSE, 55),
  ('Кипр', 'Cyprus', 'CY', 35.1264, 33.4299, 'https://flagcdn.com/w80/cy.png', TRUE, 62)
ON CONFLICT (iso_code) DO NOTHING;


INSERT INTO departure_city (name_ru, name_en, lat, lng)
VALUES
  ('Москва', 'Moscow', 55.7558, 37.6173),
  ('Санкт-Петербург', 'Saint Petersburg', 59.9311, 30.3609),
  ('Казань', 'Kazan', 55.7961, 49.1064),

  ('Екатеринбург', 'Yekaterinburg', 56.8389, 60.6057),
  ('Новосибирск', 'Novosibirsk', 55.0084, 82.9357),
  ('Самара', 'Samara', 53.1959, 50.1008),
  ('Нижний Новгород', 'Nizhny Novgorod', 56.2965, 43.9361),
  ('Ростов-на-Дону', 'Rostov-on-Don', 47.2357, 39.7015),
  ('Краснодар', 'Krasnodar', 45.0355, 38.9753),
  ('Сочи', 'Sochi', 43.5855, 39.7231),

  ('Уфа', 'Ufa', 54.7388, 55.9721),
  ('Пермь', 'Perm', 58.0105, 56.2502),
  ('Волгоград', 'Volgograd', 48.7080, 44.5133)
ON CONFLICT (name_ru) DO UPDATE
SET
  name_en = EXCLUDED.name_en,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;


WITH c AS (SELECT id AS country_id FROM country WHERE iso_code='VN'),
reg AS (
  INSERT INTO region (country_id, name_ru, name_en, lat, lng)
  SELECT country_id, 'Нячанг', 'Nha Trang', 12.2388, 109.1967 FROM c
  ON CONFLICT (country_id, name_ru) DO UPDATE
    SET name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng
  RETURNING id AS region_id, country_id
)
INSERT INTO resort (country_id, region_id, name_ru, name_en, lat, lng)
SELECT reg.country_id, reg.region_id, v.name_ru, v.name_en, v.lat, v.lng
FROM reg
JOIN (
  VALUES
    ('Нячанг',   'Nha Trang',  12.2388, 109.1967),
    ('Камрань',  'Cam Ranh',   11.9986, 109.2190),
    ('Фанранг',  'Phan Rang',  11.5640, 108.9886),
    ('Далат',    'Da Lat',     11.9404, 108.4583)
) AS v(name_ru, name_en, lat, lng) ON TRUE
ON CONFLICT (country_id, name_ru) DO UPDATE
SET region_id = EXCLUDED.region_id, name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng;

WITH c AS (SELECT id AS country_id FROM country WHERE iso_code='VN'),
reg AS (
  INSERT INTO region (country_id, name_ru, name_en, lat, lng)
  SELECT country_id, 'Фукуок', 'Phu Quoc', 10.2899, 103.9840 FROM c
  ON CONFLICT (country_id, name_ru) DO UPDATE
    SET name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng
  RETURNING id AS region_id, country_id
)
INSERT INTO resort (country_id, region_id, name_ru, name_en, lat, lng)
SELECT reg.country_id, reg.region_id, v.name_ru, v.name_en, v.lat, v.lng
FROM reg
JOIN (
  VALUES
    ('Фукуок',        'Phu Quoc',        10.2899, 103.9840),
    ('Онг Ланг',      'Ong Lang',        10.2847, 103.9447),
    ('Лонг Бич',      'Long Beach',      10.1657, 103.9681),
    ('Сансет Таун',   'Sunset Town',     10.1000, 103.9700)
) AS v(name_ru, name_en, lat, lng) ON TRUE
ON CONFLICT (country_id, name_ru) DO UPDATE
SET region_id = EXCLUDED.region_id, name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng;


WITH c AS (SELECT id AS country_id FROM country WHERE iso_code='ES'),
reg AS (
  INSERT INTO region (country_id, name_ru, name_en, lat, lng)
  SELECT country_id, 'Коста-Брава', 'Costa Brava', 41.9550, 3.2090 FROM c
  ON CONFLICT (country_id, name_ru) DO UPDATE
    SET name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng
  RETURNING id AS region_id, country_id
)
INSERT INTO resort (country_id, region_id, name_ru, name_en, lat, lng)
SELECT reg.country_id, reg.region_id, v.name_ru, v.name_en, v.lat, v.lng
FROM reg
JOIN (
  VALUES
    ('Льорет-де-Мар', 'Lloret de Mar', 41.6999, 2.8456),
    ('Тосса-де-Мар',  'Tossa de Mar',  41.7192, 2.9300),
    ('Плайя-де-Аро',  'Platja d&#39;Aro', 41.8170, 3.0670),
    ('Росас',         'Roses',         42.2620, 3.1740)
) AS v(name_ru, name_en, lat, lng) ON TRUE
ON CONFLICT (country_id, name_ru) DO UPDATE
SET region_id = EXCLUDED.region_id, name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng;

WITH c AS (SELECT id AS country_id FROM country WHERE iso_code='ES'),
reg AS (
  INSERT INTO region (country_id, name_ru, name_en, lat, lng)
  SELECT country_id, 'Коста-дель-Соль', 'Costa del Sol', 36.5099, -4.8864 FROM c
  ON CONFLICT (country_id, name_ru) DO UPDATE
    SET name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng
  RETURNING id AS region_id, country_id
)
INSERT INTO resort (country_id, region_id, name_ru, name_en, lat, lng)
SELECT reg.country_id, reg.region_id, v.name_ru, v.name_en, v.lat, v.lng
FROM reg
JOIN (
  VALUES
    ('Марбелья',   'Marbella',   36.5101, -4.8824),
    ('Малага',     'Malaga',     36.7213, -4.4214),
    ('Торремолинос','Torremolinos',36.6218, -4.5000),
    ('Фуэнхирола', 'Fuengirola', 36.5390, -4.6244)
) AS v(name_ru, name_en, lat, lng) ON TRUE
ON CONFLICT (country_id, name_ru) DO UPDATE
SET region_id = EXCLUDED.region_id, name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng;


WITH c AS (SELECT id AS country_id FROM country WHERE iso_code='IT'),
reg AS (
  INSERT INTO region (country_id, name_ru, name_en, lat, lng)
  SELECT country_id, 'Римини', 'Rimini', 44.0678, 12.5695 FROM c
  ON CONFLICT (country_id, name_ru) DO UPDATE
    SET name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng
  RETURNING id AS region_id, country_id
)
INSERT INTO resort (country_id, region_id, name_ru, name_en, lat, lng)
SELECT reg.country_id, reg.region_id, v.name_ru, v.name_en, v.lat, v.lng
FROM reg
JOIN (
  VALUES
    ('Римини',      'Rimini',      44.0678, 12.5695),
    ('Риччоне',     'Riccione',    43.9996, 12.6561),
    ('Каттолика',   'Cattolica',   43.9616, 12.7394),
    ('Чезенатико',  'Cesenatico',  44.1995, 12.3952)
) AS v(name_ru, name_en, lat, lng) ON TRUE
ON CONFLICT (country_id, name_ru) DO UPDATE
SET region_id = EXCLUDED.region_id, name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng;

WITH c AS (SELECT id AS country_id FROM country WHERE iso_code='IT'),
reg AS (
  INSERT INTO region (country_id, name_ru, name_en, lat, lng)
  SELECT country_id, 'Сицилия', 'Sicily', 37.5990, 14.0154 FROM c
  ON CONFLICT (country_id, name_ru) DO UPDATE
    SET name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng
  RETURNING id AS region_id, country_id
)
INSERT INTO resort (country_id, region_id, name_ru, name_en, lat, lng)
SELECT reg.country_id, reg.region_id, v.name_ru, v.name_en, v.lat, v.lng
FROM reg
JOIN (
  VALUES
    ('Таормина', 'Taormina', 37.8530, 15.2870),
    ('Катания',  'Catania',  37.5079, 15.0830),
    ('Палермо',  'Palermo',  38.1157, 13.3615),
    ('Чефалу',   'Cefal&ugrave;', 38.0396, 14.0227)
) AS v(name_ru, name_en, lat, lng) ON TRUE
ON CONFLICT (country_id, name_ru) DO UPDATE
SET region_id = EXCLUDED.region_id, name_en = EXCLUDED.name_en, lat = EXCLUDED.lat, lng = EXCLUDED.lng;


INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Вьетнам: Нячанг 10 ночей', 'Пляжи, острова и уличная еда. Перелёт + трансфер.', (SELECT id FROM country WHERE iso_code='VN'),
   'https://picsum.photos/seed/nhatrang/900/500', TRUE),
  ('Испания: Коста-дель-Соль 7 ночей', 'Солнце Андалусии, пляжи и тапас.', (SELECT id FROM country WHERE iso_code='ES'),
   'https://picsum.photos/seed/costadelsol/900/500', FALSE),
  ('Италия: Римини 7 ночей', 'Адриатика, прогулки и итальянская кухня.', (SELECT id FROM country WHERE iso_code='IT'),
   'https://picsum.photos/seed/rimini/900/500', FALSE)
ON CONFLICT DO NOTHING;


INSERT INTO hotel (country_id, resort_id, name, stars, address, lat, lng, description)
VALUES
  ((SELECT id FROM country WHERE iso_code='VN'),
   (SELECT id FROM resort WHERE name_ru='Нячанг' AND country_id=(SELECT id FROM country WHERE iso_code='VN') LIMIT 1),
   'Nha Trang Bay Resort', 4, 'Nha Trang', 12.2400, 109.2000, 'Тестовый 4* отель в Нячанге.'),

  ((SELECT id FROM country WHERE iso_code='ES'),
   (SELECT id FROM resort WHERE name_ru='Марбелья' AND country_id=(SELECT id FROM country WHERE iso_code='ES') LIMIT 1),
   'Marbella Sun Hotel', 5, 'Marbella', 36.5105, -4.8830, 'Тестовый 5* отель в Марбелье.'),

  ((SELECT id FROM country WHERE iso_code='IT'),
   (SELECT id FROM resort WHERE name_ru='Римини' AND country_id=(SELECT id FROM country WHERE iso_code='IT') LIMIT 1),
   'Rimini Adriatic Park', 4, 'Rimini', 44.0700, 12.5700, 'Тестовый 4* отель в Римини.')
ON CONFLICT (country_id, name) DO UPDATE
SET resort_id = EXCLUDED.resort_id,
    stars    = EXCLUDED.stars,
    address  = EXCLUDED.address,
    lat      = EXCLUDED.lat,
    lng      = EXCLUDED.lng,
    description = EXCLUDED.description;

INSERT INTO hotel_image (hotel_id, url, sort_order)
SELECT h.id, v.url, v.sort_order
FROM hotel h
JOIN (
  VALUES
    ('Nha Trang Bay Resort', 'https://picsum.photos/seed/nhatrang1/800/500', 0),
    ('Nha Trang Bay Resort', 'https://picsum.photos/seed/nhatrang2/800/500', 1),
    ('Marbella Sun Hotel',   'https://picsum.photos/seed/marbella1/800/500', 0),
    ('Marbella Sun Hotel',   'https://picsum.photos/seed/marbella2/800/500', 1),
    ('Rimini Adriatic Park', 'https://picsum.photos/seed/rimini1/800/500', 0),
    ('Rimini Adriatic Park', 'https://picsum.photos/seed/rimini2/800/500', 1)
) AS v(hotel_name, url, sort_order)
ON v.hotel_name = h.name
ON CONFLICT (hotel_id, url) DO NOTHING;


WITH dep_msk AS (SELECT id AS dc_id FROM departure_city WHERE name_ru='Москва' LIMIT 1),
     dep_spb AS (SELECT id AS dc_id FROM departure_city WHERE name_ru='Санкт-Петербург' LIMIT 1),
     dep_kzn AS (SELECT id AS dc_id FROM departure_city WHERE name_ru='Казань' LIMIT 1),
     mp_ai  AS (SELECT id AS mp_id FROM meal_plan WHERE code='AI' LIMIT 1),
     mp_bb  AS (SELECT id AS mp_id FROM meal_plan WHERE code='BB' LIMIT 1),
     mp_hb  AS (SELECT id AS mp_id FROM meal_plan WHERE code='HB' LIMIT 1)
INSERT INTO tour_offer (
  tour_id, hotel_id, departure_city_id,
  start_date, nights, meal_plan_id,
  price, currency_code, includes_flight,
  is_available, available_seats, hotel_stars_cached
)
SELECT
  (SELECT t.id FROM tour t WHERE t.country_id = h.country_id ORDER BY t.id LIMIT 1) AS tour_id,
  h.id,
  v.departure_city_id,
  v.start_date::date,
  v.nights,
  v.meal_plan_id,
  v.price,
  v.currency_code::char(3),
  v.includes_flight,
  v.is_available,
  v.available_seats,
  h.stars
FROM hotel h
JOIN (
  VALUES
    ('Nha Trang Bay Resort', (SELECT dc_id FROM dep_msk), '2026-01-10', 10, (SELECT mp_id FROM mp_bb),  1190, 'USD', TRUE, TRUE, 10),
    ('Nha Trang Bay Resort', (SELECT dc_id FROM dep_spb), '2026-01-17', 12, (SELECT mp_id FROM mp_bb),  1290, 'EUR', TRUE, TRUE, 8),

    ('Marbella Sun Hotel',   (SELECT dc_id FROM dep_msk), '2026-02-07',  7, (SELECT mp_id FROM mp_hb),  980, 'EUR', TRUE, TRUE, 12),
    ('Marbella Sun Hotel',   (SELECT dc_id FROM dep_kzn), '2026-02-14',  7, (SELECT mp_id FROM mp_hb),  1010,'EUR', TRUE, TRUE, 9),

    ('Rimini Adriatic Park', (SELECT dc_id FROM dep_msk), '2026-06-06',  7, (SELECT mp_id FROM mp_bb),  890, 'EUR', TRUE, TRUE, 14),
    ('Rimini Adriatic Park', (SELECT dc_id FROM dep_spb), '2026-06-13',  10,(SELECT mp_id FROM mp_bb),  1090,'EUR', TRUE, TRUE, 10)
) AS v(hotel_name, departure_city_id, start_date, nights, meal_plan_id, price, currency_code, includes_flight, is_available, available_seats)
ON v.hotel_name = h.name
WHERE v.departure_city_id IS NOT NULL
ON CONFLICT ON CONSTRAINT uq_offer_key DO NOTHING;


INSERT INTO review (hotel_id, author_name, rating, text, source, created_at)
SELECT h.id, v.author_name, v.rating, v.text, v.source, now() - (v.days_ago || ' days')::interval
FROM hotel h
JOIN (
  VALUES
    ('Orion Kemer Resort','Анна', 4.7, 'Отличный сервис и питание, пляж рядом.', 'site', 12),
    ('Hurghada Coral Hotel','Олег', 4.0, 'Нормально за свои деньги, море тёплое.', 'site', 25),
    ('Dubai Marina View','Денис', 4.6, 'Очень комфортно, прекрасный вид.', 'site', 15),
    ('Phuket Ocean Breeze','Светлана', 4.3, 'Пляж близко, завтраки хорошие.', 'site', 20)
) AS v(hotel_name, author_name, rating, text, source, days_ago)
ON v.hotel_name = h.name
ON CONFLICT DO NOTHING;

INSERT INTO review_image (review_id, url)
SELECT r.id, v.url
FROM review r
JOIN hotel h ON h.id = r.hotel_id
JOIN (
  VALUES
    ('Orion Kemer Resort','https://picsum.photos/seed/rev_kemer1/700/450'),
    ('Dubai Marina View','https://picsum.photos/seed/rev_dubai1/700/450')
) AS v(hotel_name, url)
ON v.hotel_name = h.name
ON CONFLICT (review_id, url) DO NOTHING;


INSERT INTO contact_message (name, phone, email, message, status, created_at)
VALUES
  ('Алексей', '+7 900 000-00-01', 'alex@site.ru', 'Подберите тур в Турцию на 7 ночей.', 'new', now() - interval '1 day'),
  ('Наталья', '+7 900 000-00-02', NULL, 'Какие есть варианты в ОАЭ на январь?', 'read', now() - interval '3 days'),
  ('Павел', '+7 900 000-00-03', 'pavel@site.ru', 'Нужна консультация по питанию AI.', 'closed', now() - interval '7 days')
ON CONFLICT DO NOTHING;

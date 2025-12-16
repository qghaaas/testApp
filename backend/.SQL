SET search_path TO oriontour;



-- 1) Справочники географии: страны, регионы, курорты
CREATE table country (
  id                BIGSERIAL PRIMARY KEY,
  name_ru           TEXT NOT NULL,
  name_en           TEXT NOT NULL,
  iso_code          CHAR(2) NOT NULL UNIQUE,
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  flag_url          TEXT,
  is_popular        BOOLEAN DEFAULT FALSE,
  popularity_score  INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);



CREATE table region (
  id          BIGSERIAL PRIMARY KEY,
  country_id  BIGINT NOT NULL REFERENCES country(id) ON DELETE CASCADE,
  name_ru     TEXT NOT NULL,
  name_en     TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_id, name_ru)
);



CREATE table resort (
  id          BIGSERIAL PRIMARY KEY,
  country_id  BIGINT NOT NULL REFERENCES country(id) ON DELETE CASCADE,
  region_id   BIGINT REFERENCES region(id) ON DELETE SET NULL,
  name_ru     TEXT NOT NULL,
  name_en     TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_id, name_ru)
);
COMMENT ON TABLE resort IS 'Курорты/локации';

CREATE index idx_resort_country ON resort(country_id);
CREATE index idx_region_country ON region(country_id);



-- 2) Точки вылета: города и аэропорты
CREATE table departure_city (
  id          BIGSERIAL PRIMARY KEY,
  name_ru     TEXT NOT NULL,
  name_en     TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name_ru)
);
COMMENT ON TABLE departure_city IS 'Города вылета';



CREATE table airport (
  id               BIGSERIAL PRIMARY KEY,
  departure_city_id BIGINT NOT NULL REFERENCES departure_city(id) ON DELETE CASCADE,
  name_ru          TEXT NOT NULL,
  iata_code        CHAR(3),
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE airport IS 'Аэропорты точки вылета';
CREATE index idx_airport_city ON airport(departure_city_id);



-- 3) Отели: основная сущность выдачи "по отелям"
CREATE table hotel (
  id            BIGSERIAL PRIMARY KEY,
  country_id    BIGINT NOT NULL REFERENCES country(id) ON DELETE CASCADE,
  resort_id     BIGINT REFERENCES resort(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  stars         SMALLINT CHECK (stars BETWEEN 1 AND 5),
  address       TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_id, name)
);



CREATE table hotel_image (
  id          BIGSERIAL PRIMARY KEY,
  hotel_id    BIGINT NOT NULL REFERENCES hotel(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE hotel_image IS 'Фотографии отеля (галерея + превью в выдаче).';

CREATE index idx_hotel_country ON hotel(country_id);
CREATE index idx_hotel_resort ON hotel(resort_id);
CREATE index idx_hotel_image_hotel ON hotel_image(hotel_id);



-- 4) Удобства отелей (для расширенных фильтров)
CREATE table amenity (
  id        BIGSERIAL PRIMARY KEY,
  code      TEXT NOT NULL UNIQUE,
  name_ru   TEXT NOT NULL,
  name_en   TEXT
);
COMMENT ON TABLE amenity IS 'Справочник удобств (Wi-Fi, бассейн, первая линия и т.д.).';

CREATE table hotel_amenity (
  hotel_id   BIGINT NOT NULL REFERENCES hotel(id) ON DELETE CASCADE,
  amenity_id BIGINT NOT NULL REFERENCES amenity(id) ON DELETE CASCADE,
  PRIMARY KEY (hotel_id, amenity_id)
);
COMMENT ON TABLE hotel_amenity IS 'Связь отелей и удобств (многие-ко-многим).';



-- 5) Питание, валюта и курсы
CREATE table meal_plan (
  id        BIGSERIAL PRIMARY KEY,
  code      TEXT NOT NULL UNIQUE,     -- RO, BB, HB, FB, AI, UAI
  name_ru   TEXT NOT NULL,
  name_en   TEXT
);
COMMENT ON TABLE meal_plan IS 'Тип питания';



CREATE table currency (
  code      CHAR(3) PRIMARY KEY,      -- RUB, USD, EUR
  name_ru   TEXT NOT NULL,
  symbol    TEXT
);
COMMENT ON TABLE currency IS 'Справочник валют';



CREATE table fx_rate (
  id            BIGSERIAL PRIMARY KEY,
  base_code     CHAR(3) NOT NULL REFERENCES currency(code),
  quote_code    CHAR(3) NOT NULL REFERENCES currency(code),
  rate          NUMERIC(18,8) NOT NULL CHECK(rate > 0),
  effective_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_code, quote_code, effective_at)
);
COMMENT ON TABLE fx_rate IS 'Курсы валют для пересчёта цен/фильтра по валюте.';



-- 6) Маркетинговые карточки туров (как "Анталия 7 ночей")
CREATE table tour (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  short_desc    TEXT,
  country_id    BIGINT NOT NULL REFERENCES country(id) ON DELETE CASCADE,
  image_url     TEXT,
  is_hot        BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE tour IS 'Маркетинговая сущность "тур" (карточка/направление)';

CREATE index idx_tour_country ON tour(country_id);



-- 7) Конкретные предложения 
CREATE table tour_offer (
  id                BIGSERIAL PRIMARY KEY,
  tour_id            BIGINT REFERENCES tour(id) ON DELETE SET NULL,
  hotel_id           BIGINT NOT NULL REFERENCES hotel(id) ON DELETE CASCADE,

  departure_city_id  BIGINT NOT NULL REFERENCES departure_city(id) ON DELETE RESTRICT,
  airport_id         BIGINT REFERENCES airport(id) ON DELETE SET NULL,

  start_date         DATE NOT NULL,              -- дата вылета
  nights             SMALLINT NOT NULL CHECK(nights BETWEEN 1 AND 60),

  meal_plan_id       BIGINT REFERENCES meal_plan(id) ON DELETE SET NULL,

  price              NUMERIC(12,2) NOT NULL CHECK(price >= 0),
  currency_code      CHAR(3) NOT NULL REFERENCES currency(code),

  includes_flight    BOOLEAN NOT NULL DEFAULT TRUE,   -- "Туры с авиабилетами"
  is_available       BOOLEAN NOT NULL DEFAULT TRUE,   -- "Есть места в отеле"
  available_seats    INTEGER,                         -- опционально

  hotel_stars_cached SMALLINT,                        -- ускоряет фильтр по звёздам 
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE tour_offer IS 'Конкретное предложение: отель + вылет + дата + ночи + питание + цена + наличие (главная таблица для фильтров/поиска).';

CREATE index idx_offer_filter_main
  ON tour_offer(departure_city_id, start_date, nights, includes_flight, is_available);

CREATE index idx_offer_hotel ON tour_offer(hotel_id);
CREATE INDEX idx_offer_meal ON tour_offer(meal_plan_id);
CREATE INDEX idx_offer_price ON tour_offer(price);
CREATE INDEX idx_offer_currency ON tour_offer(currency_code);



-- 8) Отзывы (рейтинг/кол-во отзывов как в выдаче)
CREATE table review (
  id          BIGSERIAL PRIMARY KEY,
  hotel_id    BIGINT NOT NULL REFERENCES hotel(id) ON DELETE CASCADE,
  author_name TEXT,
  rating      NUMERIC(2,1) NOT NULL CHECK(rating BETWEEN 0 AND 5),
  text        TEXT,
  source      TEXT, -- 'site', 'import', 'instagram' и т.п.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE review IS 'Отзывы по отелям (для рейтинга и количества отзывов в выдаче).';

CREATE table review_image (
  id        BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES review(id) ON DELETE CASCADE,
  url       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE index idx_review_hotel ON review(hotel_id);



-- 9) Заявки/бронирование (формы + статусы)
CREATE table booking_request (
  id               BIGSERIAL PRIMARY KEY,
  offer_id         BIGINT REFERENCES tour_offer(id) ON DELETE SET NULL,

  customer_name    TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT,
  comment          TEXT,

  adults_count     SMALLINT NOT NULL DEFAULT 2 CHECK(adults_count BETWEEN 1 AND 10),
  children_count   SMALLINT NOT NULL DEFAULT 0 CHECK(children_count BETWEEN 0 AND 6),

  status           TEXT NOT NULL DEFAULT 'new'
                   CHECK(status IN ('new','in_work','confirmed','cancelled','closed')),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE booking_request IS 'Заявки на бронирование (форма "Забронировать", хранение + статусы обработки менеджером).';

CREATE table booking_child (
  id          BIGSERIAL PRIMARY KEY,
  request_id  BIGINT NOT NULL REFERENCES booking_request(id) ON DELETE CASCADE,
  age         SMALLINT NOT NULL CHECK(age BETWEEN 0 AND 17)
);
COMMENT ON TABLE booking_child IS 'Возраст детей по заявке (как в форме: 1-3 ребёнка и возраст каждого).';

CREATE index idx_booking_status ON booking_request(status);
CREATE index idx_booking_offer ON booking_request(offer_id);



-- 10) Контакты/обратная связь 
CREATE table contact_message (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT,
  phone       TEXT,
  email       TEXT,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','read','closed'))
);
COMMENT ON TABLE contact_message IS 'Сообщения из формы "Контакты/обратная связь".';




-- 11) VIEW: маркеры для глобуса/карты (страна + кол-во офферов)
CREATE OR REPLACE VIEW globe_markers AS
SELECT
  c.id,
  c.name_ru,
  c.name_en,
  c.iso_code,
  c.lat,
  c.lng,
  c.flag_url,
  c.is_popular,
  c.popularity_score,
  COALESCE(COUNT(DISTINCT h.id), 0) AS hotels_count,
  COALESCE(COUNT(o.id), 0)          AS offers_count
FROM country c
LEFT JOIN hotel h      ON h.country_id = c.id
LEFT JOIN tour_offer o ON o.hotel_id = h.id
GROUP BY c.id, c.name_ru, c.name_en, c.iso_code, c.lat, c.lng, c.flag_url, c.is_popular, c.popularity_score;
COMMENT ON VIEW globe_markers IS 'Данные для глобуса/карты: координаты страны + количество отелей и предложений.';



-- 12) VIEW: выдача "по отелям" (цена от + рейтинг + кол-во отзывов)
CREATE OR REPLACE VIEW hotel_listing AS
SELECT
  h.id AS hotel_id,
  h.name,
  h.stars,
  h.country_id,
  h.resort_id,
  MIN(o.price) AS price_from,
  (SELECT hi.url FROM hotel_image hi WHERE hi.hotel_id = h.id ORDER BY hi.sort_order, hi.id LIMIT 1) AS preview_image_url,
  COALESCE(AVG(r.rating), 0) AS rating_avg,
  COUNT(r.id) AS reviews_count,
  COUNT(o.id) AS offers_count
FROM hotel h
LEFT JOIN tour_offer o ON o.hotel_id = h.id AND o.is_available = TRUE
LEFT JOIN review r     ON r.hotel_id = h.id
GROUP BY h.id;
COMMENT ON VIEW hotel_listing IS 'Выдача "по отелям": превью, цена от, рейтинг и количество отзывов, количество предложений.';



-- 13) Триггер updated_at (автоматически обновлять)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  -- Применяем к таблицам, где есть updated_at
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_country_updated') THEN
    CREATE TRIGGER tr_country_updated BEFORE UPDATE ON country FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_region_updated') THEN
    CREATE TRIGGER tr_region_updated BEFORE UPDATE ON region FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_resort_updated') THEN
    CREATE TRIGGER tr_resort_updated BEFORE UPDATE ON resort FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_departure_city_updated') THEN
    CREATE TRIGGER tr_departure_city_updated BEFORE UPDATE ON departure_city FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_airport_updated') THEN
    CREATE TRIGGER tr_airport_updated BEFORE UPDATE ON airport FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_hotel_updated') THEN
    CREATE TRIGGER tr_hotel_updated BEFORE UPDATE ON hotel FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_tour_updated') THEN
    CREATE TRIGGER tr_tour_updated BEFORE UPDATE ON tour FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_offer_updated') THEN
    CREATE TRIGGER tr_offer_updated BEFORE UPDATE ON tour_offer FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_booking_updated') THEN
    CREATE TRIGGER tr_booking_updated BEFORE UPDATE ON booking_request FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;



INSERT INTO currency(code, name_ru, symbol) VALUES
  ('RUB','Российский рубль','₽'),
  ('USD','Доллар США','$'),
  ('EUR','Евро','€')
ON CONFLICT (code) DO NOTHING;

INSERT INTO meal_plan(code, name_ru) VALUES
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
  ('Греция', 'Greece', 'GR', 39.0742, 21.8243, 'https://flagcdn.com/w80/gr.png', TRUE, 80),
  ('Италия', 'Italy', 'IT', 41.8719, 12.5674, 'https://flagcdn.com/w80/it.png', TRUE, 85),
  ('Испания', 'Spain', 'ES', 40.4637, -3.7492, 'https://flagcdn.com/w80/es.png', TRUE, 75),
  ('ОАЭ', 'United Arab Emirates', 'AE', 23.4241, 53.8478, 'https://flagcdn.com/w80/ae.png', TRUE, 70),
  ('Таиланд', 'Thailand', 'TH', 15.8700, 100.9925, 'https://flagcdn.com/w80/th.png', TRUE, 65),
  ('Россия', 'Russia', 'RU', 61.5240, 105.3188, 'https://flagcdn.com/w80/ru.png', FALSE, 50),
  ('Кипр', 'Cyprus', 'CY', 35.1264, 33.4299, 'https://flagcdn.com/w80/cy.png', TRUE, 60),
  ('Черногория', 'Montenegro', 'ME', 42.7087, 19.3744, 'https://flagcdn.com/w80/me.png', FALSE, 45),
  ('Тунис', 'Tunisia', 'TN', 33.8869, 9.5375, 'https://flagcdn.com/w80/tn.png', TRUE, 55),
  ('Вьетнам', 'Vietnam', 'VN', 14.0583, 108.2772, 'https://flagcdn.com/w80/vn.png', TRUE, 58),
  ('Грузия', 'Georgia', 'GE', 42.3154, 43.3569, 'https://flagcdn.com/w80/ge.png', FALSE, 40),
  ('Франция', 'France', 'FR', 46.2276, 2.2137, 'https://flagcdn.com/w80/fr.png', TRUE, 72),
  ('Мальдивы', 'Maldives', 'MV', 3.2028, 73.2207, 'https://flagcdn.com/w80/mv.png', TRUE, 78),
  ('Шри-Ланка', 'Sri Lanka', 'LK', 7.8731, 80.7718, 'https://flagcdn.com/w80/lk.png', TRUE, 52),
  ('Индонезия', 'Indonesia', 'ID', -0.7893, 113.9213, 'https://flagcdn.com/w80/id.png', TRUE, 62),
  ('Болгария', 'Bulgaria', 'BG', 42.7339, 25.4858, 'https://flagcdn.com/w80/bg.png', FALSE, 43);

  

  -- Турция
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Анталия All Inclusive 7 ночей',
   'Пляжный отдых в Анталии: отель 4*, питание "всё включено", перелёт и трансфер.',
   (SELECT id FROM country WHERE iso_code='TR'),
   'https://picsum.photos/seed/antalya/900/500', TRUE),

  ('Стамбул: уикенд в двух частях света',
   '3–4 ночи в Стамбуле: европейская и азиатская часть, топ-достопримечательности.',
   (SELECT id FROM country WHERE iso_code='TR'),
   'https://picsum.photos/seed/istanbul/900/500', FALSE),

  ('Кемер: море, горы и хвойные леса',
   '7 ночей в Кемере: пляжи, горы Таурус, отели 4–5*.',
   (SELECT id FROM country WHERE iso_code='TR'),
   'https://picsum.photos/seed/kemer/900/500', TRUE),

  ('Каппадокия: воздушные шары и долины',
   '3 ночи в Каппадокии: рассветы, шары, долины и пещерные отели.',
   (SELECT id FROM country WHERE iso_code='TR'),
   'https://picsum.photos/seed/cappadocia/900/500', FALSE);


-- Египет
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Хургада: Красное море и кораллы',
   '7 ночей в Хургаде: отель 4*, первая линия, снорклинг и дайвинг.',
   (SELECT id FROM country WHERE iso_code='EG'),
   'https://picsum.photos/seed/hurghada/900/500', TRUE),

  ('Шарм-эль-Шейх: отдых для двоих',
   'Отель 5*, SPA, красивые бухты и романтические ужины.',
   (SELECT id FROM country WHERE iso_code='EG'),
   'https://picsum.photos/seed/sharm/900/500', FALSE),

  ('Каир + пирамиды Гизы',
   '3 ночи: музей, пирамиды и Сфинкс + прогулка по Нилу (по желанию).',
   (SELECT id FROM country WHERE iso_code='EG'),
   'https://picsum.photos/seed/cairo/900/500', FALSE);


-- Греция
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Афины + острова Саронического залива',
   'Исторические Афины и круиз по островам Эгина, Порос, Гидра.',
   (SELECT id FROM country WHERE iso_code='GR'),
   'https://picsum.photos/seed/athens/900/500', FALSE),

  ('Крит: семейный отдых',
   '7 ночей на Крите: отель с детской инфраструктурой и песчаным пляжем.',
   (SELECT id FROM country WHERE iso_code='GR'),
   'https://picsum.photos/seed/crete/900/500', TRUE),

  ('Родос: крепости, бухты и пляжи',
   '7 ночей на Родосе: старый город, бухты, комфортный пляжный отдых.',
   (SELECT id FROM country WHERE iso_code='GR'),
   'https://picsum.photos/seed/rhodes/900/500', TRUE);


-- Италия
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Рим + Ватикан: классика Италии',
   'Рим, Колизей, Ватикан и итальянская кухня — насыщенная экскурсионка.',
   (SELECT id FROM country WHERE iso_code='IT'),
   'https://picsum.photos/seed/rome/900/500', FALSE),

  ('Венеция и романтика каналов',
   '3–4 ночи: прогулка на гондоле, острова лагуны и гастрономия.',
   (SELECT id FROM country WHERE iso_code='IT'),
   'https://picsum.photos/seed/venice/900/500', TRUE),

  ('Милан + Комо: стиль и озёра',
   '3 ночи: Милан, шопинг, архитектура и поездка на озеро Комо.',
   (SELECT id FROM country WHERE iso_code='IT'),
   'https://picsum.photos/seed/milan/900/500', FALSE);


-- Испания
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Барселона: Гауди и море',
   'Саграда Фамилия, парк Гуэля и пляжи — 5 дней яркой Испании.',
   (SELECT id FROM country WHERE iso_code='ES'),
   'https://picsum.photos/seed/barcelona/900/500', TRUE),

  ('Мадрид: искусство и гастрономия',
   'Прадо, Рейна София, тапас-бары и атмосферные районы Мадрида.',
   (SELECT id FROM country WHERE iso_code='ES'),
   'https://picsum.photos/seed/madrid/900/500', FALSE),

  ('Тенерифе: океан и вулкан Тейде',
   '7 ночей на Канарах: океан, Тейде и комфортный отдых круглый год.',
   (SELECT id FROM country WHERE iso_code='ES'),
   'https://picsum.photos/seed/tenerife/900/500', TRUE);


-- ОАЭ
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Дубай: небоскрёбы и шопинг',
   'Бурдж-Халифа, сафари по пустыне и шопинг в Dubai Mall — 5 ночей.',
   (SELECT id FROM country WHERE iso_code='AE'),
   'https://picsum.photos/seed/dubai/900/500', TRUE),

  ('Абу-Даби: восточная роскошь',
   'Мечеть шейха Зайда, набережные и пляжный релакс.',
   (SELECT id FROM country WHERE iso_code='AE'),
   'https://picsum.photos/seed/abudhabi/900/500', FALSE),

  ('Рас-эль-Хайма: пляжи и спокойный отдых',
   '7 ночей: более тихая альтернатива Дубаю, хорошие пляжи и отели.',
   (SELECT id FROM country WHERE iso_code='AE'),
   'https://picsum.photos/seed/rak/900/500', TRUE);


-- Таиланд
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Пхукет: тропический рай',
   '7 ночей: пляжи, острова Пхи-Пхи, лазурное море и экскурсии.',
   (SELECT id FROM country WHERE iso_code='TH'),
   'https://picsum.photos/seed/phuket/900/500', TRUE),

  ('Бангкок + пляжи Паттайи',
   'Контрастный тур: мегаполис Бангкок + пляжный отдых.',
   (SELECT id FROM country WHERE iso_code='TH'),
   'https://picsum.photos/seed/bangkok/900/500', FALSE),

  ('Самуи: релакс на острове',
   '7 ночей на Самуи: спокойные пляжи, кокосовые рощи и мягкий ритм.',
   (SELECT id FROM country WHERE iso_code='TH'),
   'https://picsum.photos/seed/samui/900/500', TRUE);

  
-- Россия
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Сочи: отдых на Чёрном море',
   '7 ночей: набережная, Красная Поляна и экскурсии в горы.',
   (SELECT id FROM country WHERE iso_code='RU'),
   'https://picsum.photos/seed/sochi/900/500', FALSE),

  ('Санкт-Петербург: белые ночи',
   'Эрмитаж, Невский и развод мостов — классика культурной столицы.',
   (SELECT id FROM country WHERE iso_code='RU'),
   'https://picsum.photos/seed/spb/900/500', TRUE),

  -- ДОБАВИЛ:
  ('Калининград: Балтика и старые улочки',
   '4–5 дней: Куршская коса, море, янтарь и атмосферные города региона.',
   (SELECT id FROM country WHERE iso_code='RU'),
   'https://picsum.photos/seed/kaliningrad/900/500', TRUE);


-- Мальдивы
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Мальдивы: вилла над лагуной',
   '7 ночей: бирюзовая вода, приватность, снорклинг у рифов.',
   (SELECT id FROM country WHERE iso_code='MV'),
   'https://picsum.photos/seed/maldives/900/500', TRUE);


-- Вьетнам
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Нячанг: пляжи и термальные источники',
   '10 ночей: море, острова, морепродукты и экскурсии.',
   (SELECT id FROM country WHERE iso_code='VN'),
   'https://picsum.photos/seed/nha-trang/900/500', TRUE);


-- Кипр
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Кипр: Айя-Напа и лучшие пляжи',
   '7 ночей: пляжный отдых, чистое море, вечерняя жизнь.',
   (SELECT id FROM country WHERE iso_code='CY'),
   'https://picsum.photos/seed/cyprus/900/500', TRUE);


-- Франция
INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
VALUES
  ('Париж: уикенд мечты',
   '3 ночи: Лувр, Эйфелева башня, Монмартр и круассаны.',
   (SELECT id FROM country WHERE iso_code='FR'),
   'https://picsum.photos/seed/paris/900/500', FALSE);



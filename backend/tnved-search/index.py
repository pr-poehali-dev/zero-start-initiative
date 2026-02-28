"""
Поиск кодов ТН ВЭД по названию товара и получение деталей по коду через Alta.ru.
Возвращает список подходящих кодов с наименованиями, ставками пошлин и ссылками.
"""
import json
import re
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
}

TNVED_NAMES = {
    "01": "Живые животные", "02": "Мясо и пищевые мясные субпродукты",
    "03": "Рыба и ракообразные", "04": "Молочная продукция, яйца птиц, мёд",
    "05": "Продукты животного происхождения", "06": "Живые деревья и другие растения",
    "07": "Овощи и корнеплоды", "08": "Съедобные фрукты и орехи",
    "09": "Кофе, чай, пряности", "10": "Злаки",
    "11": "Продукция мукомольной промышленности", "12": "Масличные семена и плоды",
    "13": "Шеллак, смолы, камеди", "14": "Растительные материалы",
    "15": "Жиры и масла", "16": "Готовые продукты из мяса и рыбы",
    "17": "Сахар и кондитерские изделия", "18": "Какао и продукты из него",
    "19": "Готовые продукты из зерна, муки", "20": "Продукты переработки овощей, фруктов",
    "21": "Разные пищевые продукты", "22": "Алкогольные и безалкогольные напитки",
    "23": "Остатки пищевой промышленности, корма", "24": "Табак и промышленные заменители",
    "25": "Соль, сера, земли, камни", "26": "Руды, шлаки, зола",
    "27": "Топливо, нефть, битуминозные вещества", "28": "Продукты неорганической химии",
    "29": "Органические химические соединения", "30": "Фармацевтическая продукция",
    "31": "Удобрения", "32": "Красители, лаки, краски",
    "33": "Эфирные масла, парфюмерия, косметика", "34": "Мыло, чистящие средства",
    "35": "Белковые вещества, крахмалы, клеи", "36": "Взрывчатые вещества, спички",
    "37": "Фото- и кинотовары", "38": "Продукты химической промышленности",
    "39": "Пластмассы и изделия из них", "40": "Каучук, резина и изделия из них",
    "41": "Необработанные шкуры и кожи", "42": "Изделия из кожи, сёдла, дорожные товары",
    "43": "Натуральный и искусственный мех", "44": "Древесина и изделия из дерева",
    "45": "Пробка и изделия из неё", "46": "Изделия из соломы и лыка",
    "47": "Масса из древесины, бумажная масса", "48": "Бумага и картон",
    "49": "Печатная продукция, книги", "50": "Шёлк",
    "51": "Шерсть, тонкий или грубый волос", "52": "Хлопок",
    "53": "Прочие растительные текстильные волокна", "54": "Химические нити",
    "55": "Химические волокна", "56": "Вата, войлок, нетканые материалы",
    "57": "Ковры и напольные покрытия", "58": "Специальные тканые полотна, кружева",
    "59": "Текстильные материалы с пропиткой", "60": "Трикотажные полотна",
    "61": "Трикотажная одежда", "62": "Одежда и принадлежности (не трикотаж)",
    "63": "Готовые текстильные изделия прочие", "64": "Обувь",
    "65": "Головные уборы", "66": "Зонты, трости, хлысты",
    "67": "Перья, пух, искусственные цветы", "68": "Изделия из камня, гипса, цемента",
    "69": "Керамические изделия", "70": "Стекло и изделия из него",
    "71": "Жемчуг, драгоценные камни, металлы, бижутерия", "72": "Чёрные металлы",
    "73": "Изделия из чёрных металлов", "74": "Медь и изделия из неё",
    "75": "Никель и изделия из него", "76": "Алюминий и изделия из него",
    "78": "Свинец и изделия из него", "79": "Цинк и изделия из него",
    "80": "Олово и изделия из него", "81": "Прочие недрагоценные металлы",
    "82": "Инструменты, ножи, столовые приборы", "83": "Прочие изделия из недрагоценных металлов",
    "84": "Ядерные реакторы, котлы, оборудование", "85": "Электрические машины, оборудование",
    "86": "Железнодорожный транспорт", "87": "Автомобили, тракторы, велосипеды",
    "88": "Летательные аппараты", "89": "Суда и плавучие конструкции",
    "90": "Оптические, фото-, медицинские инструменты", "91": "Часы",
    "92": "Музыкальные инструменты", "93": "Оружие и боеприпасы",
    "94": "Мебель, постельные принадлежности, светильники", "95": "Игрушки, игры, спортивный инвентарь",
    "96": "Разные готовые изделия", "97": "Произведения искусства, антиквариат",
}


def get_group_name(code: str) -> str:
    return TNVED_NAMES.get(code[:2], "")


def fetch_page(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=12) as resp:
        return resp.read().decode("utf-8")


def parse_meta(html: str, name: str) -> str:
    m = re.search(rf'<meta\s+(?:name|property)=["\'](?:og:)?{re.escape(name)}["\']\s+content=["\'](.*?)["\']', html, re.I)
    return m.group(1).strip() if m else ""


def get_code_details(code: str) -> dict:
    """Получаем детали по коду ТН ВЭД с Alta.ru через мета-теги страницы."""
    code_digits = re.sub(r'\D', '', code)
    if len(code_digits) < 4:
        return {}

    if len(code_digits) == 4:
        code_digits = code_digits + "00000000"[:10 - len(code_digits)]
    elif len(code_digits) < 10:
        code_digits = code_digits + "0" * (10 - len(code_digits))

    url = f"https://www.alta.ru/tnved/code/{code_digits}/"
    try:
        html = fetch_page(url)
    except Exception:
        return {}

    description_raw = parse_meta(html, "description")

    full_name = ""
    duty = ""
    vat = ""

    m_name = re.search(rf'{re.escape(code_digits)}:\s*(.+?)(?:\.\s*Базовая ставка|$)', description_raw)
    if m_name:
        full_name = m_name.group(1).strip()

    m_duty = re.search(r'Базовая ставка таможенной пошлины:\s*([^,]+)', description_raw)
    if m_duty:
        duty_raw = m_duty.group(1).strip()
        duty = duty_raw if duty_raw not in ("", "0") else "0%"

    m_vat = re.search(r'НДС[:\s]+(\d+\s*%)', description_raw, re.I)
    if m_vat:
        vat = m_vat.group(1).strip()
    else:
        m_vat2 = re.search(r'НДС\s*(\d+)', description_raw, re.I)
        if m_vat2:
            vat = m_vat2.group(1) + "%"

    title_m = re.search(r'<title>(.*?)</title>', html, re.I | re.S)
    page_title = title_m.group(1).strip() if title_m else ""
    if not full_name and page_title:
        t = re.sub(r'Код ТН ВЭД \d+\.?\s*', '', page_title)
        t = re.sub(r'\|.*$', '', t).strip()
        if t:
            full_name = t

    return {
        "code": code_digits,
        "full_name": full_name,
        "duty": duty or "уточняется",
        "vat": vat or "уточняется",
        "url": url,
        "source": "alta.ru",
    }


def search_tnved(query: str):
    encoded = urllib.parse.quote(query)
    url = f"https://www.alta.ru/tnved/xml_apu/?q={encoded}&limit=5"
    content = fetch_page(url)
    root = ET.fromstring(content)
    results = []

    for line in root.findall("line"):
        term = line.findtext("term", "").strip()
        tngroup = line.findtext("tngroup", "").strip()
        if not tngroup:
            continue
        codes = [c.strip() for c in tngroup.split(",") if c.strip()][:5]
        for code in codes:
            results.append({
                "code": code,
                "name": term,
                "group_name": get_group_name(code),
                "url": f"https://www.alta.ru/tnved/?search={urllib.parse.quote(term)}",
            })
        if len(results) >= 8:
            break

    seen = set()
    unique = []
    for r in results:
        if r["code"] not in seen:
            seen.add(r["code"])
            unique.append(r)
    return unique[:8]


def handler(event: dict, context) -> dict:
    """Поиск кодов ТН ВЭД и получение деталей (пошлины, НДС) с сайта Alta.ru."""
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
        params = event.get("queryStringParameters") or {}

        action = body.get("action") or params.get("action", "search")

        if action == "details":
            code = body.get("code") or params.get("code", "")
            if not code:
                return {
                    "statusCode": 400,
                    "headers": cors,
                    "body": json.dumps({"error": "Укажите code"}, ensure_ascii=False),
                }
            details = get_code_details(code)
            return {
                "statusCode": 200,
                "headers": {**cors, "Content-Type": "application/json; charset=utf-8"},
                "body": json.dumps(details, ensure_ascii=False),
            }

        query = body.get("query") or params.get("query", "")
        if not query:
            return {
                "statusCode": 400,
                "headers": cors,
                "body": json.dumps({"error": "Укажите параметр query"}, ensure_ascii=False),
            }

        results = search_tnved(query.strip())
        return {
            "statusCode": 200,
            "headers": {**cors, "Content-Type": "application/json; charset=utf-8"},
            "body": json.dumps({"query": query, "results": results, "source": "alta.ru"}, ensure_ascii=False),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": cors,
            "body": json.dumps({"error": str(e)}, ensure_ascii=False),
        }
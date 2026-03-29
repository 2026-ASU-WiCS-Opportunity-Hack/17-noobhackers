"""Seed 50 coach profiles into DynamoDB with Cohere embeddings.

Run: cd backend && PYTHONPATH=lambda python scripts/seed_coaches.py
"""

import json
import os
import uuid
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal

import boto3

COACHES_TABLE = os.environ.get("COACHES_TABLE", "wial-coaches")
COHERE_SECRET = os.environ.get("COHERE_SECRET_NAME", "wial/cohere-api-key")
CHAPTER_ID = os.environ.get("CHAPTER_ID", "6993880c-5b5c-4a56-aed8-faae8314888e")

dynamodb = boto3.resource("dynamodb", region_name="us-east-2")
secrets = boto3.client("secretsmanager", region_name="us-east-2")
table = dynamodb.Table(COACHES_TABLE)

secret = json.loads(secrets.get_secret_value(SecretId=COHERE_SECRET)["SecretString"])
COHERE_KEY = secret["apiKey"]

COACHES = [
    # North America
    {"name":"John Smith","cert":"CALC","location":"New York, USA","country":"USA","bio":"Newly certified coach bringing Action Learning to corporate America. Background in management consulting.","languages":["English"]},
    {"name":"Lisa Chen","cert":"PALC","location":"San Francisco, USA","country":"USA","bio":"Professional coach specializing in tech industry leadership. Works with Silicon Valley startups on team dynamics.","languages":["English","Mandarin"]},
    {"name":"Robert Johnson","cert":"SALC","location":"Chicago, USA","country":"USA","bio":"Senior coach with 10 years experience in manufacturing and supply chain leadership development.","languages":["English"]},
    {"name":"Marie Tremblay","cert":"PALC","location":"Montreal, Canada","country":"Canada","bio":"Coach professionnelle bilingue spécialisée dans le développement du leadership dans les organisations gouvernementales canadiennes.","languages":["French","English"]},
    {"name":"Maria Garcia","cert":"PALC","location":"Mexico City, Mexico","country":"Mexico","bio":"Coach profesional con experiencia en educación y liderazgo del sector público. Defensora del Action Learning en organizaciones gubernamentales.","languages":["Spanish","English"]},
    {"name":"Carlos Rivera","cert":"CALC","location":"Guadalajara, Mexico","country":"Mexico","bio":"Coach certificado enfocado en desarrollo de liderazgo en la industria automotriz mexicana.","languages":["Spanish","English"]},
    # South America
    {"name":"Carlos Mendes","cert":"SALC","location":"São Paulo, Brazil","country":"Brazil","bio":"Coach sênior especializado em transformação organizacional na América Latina. Fluente em português, espanhol e inglês.","languages":["Portuguese","Spanish","English"]},
    {"name":"Ana Oliveira","cert":"PALC","location":"Rio de Janeiro, Brazil","country":"Brazil","bio":"Coach profissional focada em dinâmica de equipes na indústria manufatureira e desenvolvimento comunitário.","languages":["Portuguese","English"]},
    {"name":"Diego Fernandez","cert":"CALC","location":"Buenos Aires, Argentina","country":"Argentina","bio":"Coach certificado especializado en desarrollo de liderazgo en el sector financiero argentino.","languages":["Spanish","English"]},
    {"name":"Valentina Rojas","cert":"PALC","location":"Bogotá, Colombia","country":"Colombia","bio":"Coach profesional trabajando con organizaciones sin fines de lucro y agencias gubernamentales en Colombia.","languages":["Spanish","English"]},
    {"name":"Pedro Castillo","cert":"CALC","location":"Lima, Peru","country":"Peru","bio":"Coach certificado enfocado en minería y desarrollo sostenible en los Andes peruanos.","languages":["Spanish","Quechua","English"]},
    # Europe
    {"name":"Emily Thompson","cert":"PALC","location":"London, UK","country":"United Kingdom","bio":"Professional coach working with Fortune 500 companies on leadership development and team effectiveness.","languages":["English"]},
    {"name":"James Wilson","cert":"SALC","location":"Edinburgh, UK","country":"United Kingdom","bio":"Senior coach specializing in financial services and healthcare leadership in the UK.","languages":["English"]},
    {"name":"Sophie Dubois","cert":"MALC","location":"Paris, France","country":"France","bio":"Coach maître et chercheuse publiée sur la méthodologie de l'Action Learning. Spécialisée dans la transformation organisationnelle.","languages":["French","English"]},
    {"name":"Hans Mueller","cert":"SALC","location":"Berlin, Germany","country":"Germany","bio":"Erfahrener Senior-Coach mit Expertise im Automobil- und Ingenieursektor. Spezialisiert auf Führungskräfteentwicklung.","languages":["German","English"]},
    {"name":"Katrin Weber","cert":"PALC","location":"Munich, Germany","country":"Germany","bio":"Professionelle Coach für digitale Transformation und agile Führung in der Technologiebranche.","languages":["German","English"]},
    {"name":"Marco Rossi","cert":"PALC","location":"Milan, Italy","country":"Italy","bio":"Coach professionista specializzato in leadership nel settore moda e design. Esperto di dinamiche di team creativi.","languages":["Italian","English"]},
    {"name":"Elena Petrova","cert":"SALC","location":"Moscow, Russia","country":"Russia","bio":"Старший коуч с опытом работы в энергетическом секторе и государственном управлении. Специализация на развитии лидерства.","languages":["Russian","English"]},
    {"name":"Anna Kowalski","cert":"CALC","location":"Warsaw, Poland","country":"Poland","bio":"Certyfikowany coach skupiony na rozwoju przywództwa w sektorze IT i startupach technologicznych w Europie Środkowej.","languages":["Polish","English"]},
    {"name":"Lars Eriksson","cert":"PALC","location":"Stockholm, Sweden","country":"Sweden","bio":"Professional coach working with Nordic companies on sustainable leadership and innovation management.","languages":["Swedish","English"]},
    {"name":"Isabel Santos","cert":"CALC","location":"Lisbon, Portugal","country":"Portugal","bio":"Coach certificada focada em empreendedorismo e desenvolvimento de PMEs em Portugal e países lusófonos.","languages":["Portuguese","English"]},
    {"name":"Pieter van Dijk","cert":"PALC","location":"Amsterdam, Netherlands","country":"Netherlands","bio":"Professional coach gespecialiseerd in internationale teams en cross-cultureel leiderschap.","languages":["Dutch","English","German"]},
    {"name":"Mehmet Yilmaz","cert":"CALC","location":"Istanbul, Turkey","country":"Turkey","bio":"Sertifikalı koç, Türk iş dünyasında liderlik gelişimi ve organizasyonel dönüşüm konularında uzmanlaşmıştır.","languages":["Turkish","English"]},
    # Asia Pacific
    {"name":"Dr. Sarah Chen","cert":"MALC","location":"Singapore","country":"Singapore","bio":"Master Action Learning Coach with 15 years facilitating leadership programs across Asia Pacific. Cross-cultural team dynamics expert.","languages":["English","Mandarin"]},
    {"name":"Kenji Tanaka","cert":"SALC","location":"Tokyo, Japan","country":"Japan","bio":"製造業とテクノロジーセクターを専門とするシニアコーチ。リーン・リーダーシップの深い専門知識を持つ。","languages":["Japanese","English"]},
    {"name":"Yuki Sato","cert":"PALC","location":"Osaka, Japan","country":"Japan","bio":"プロフェッショナルコーチ。ヘルスケアと教育分野でのアクションラーニング実践に注力。","languages":["Japanese","English"]},
    {"name":"Priya Sharma","cert":"CALC","location":"Mumbai, India","country":"India","bio":"एक्शन लर्निंग के माध्यम से दक्षिण एशिया में नेतृत्व विकास के लिए समर्पित प्रमाणित कोच। IT और फिनटेक क्षेत्रों में विशेषज्ञता।","languages":["Hindi","English","Marathi"]},
    {"name":"Rajesh Kumar","cert":"SALC","location":"Bangalore, India","country":"India","bio":"Senior coach specializing in IT services and digital transformation leadership in India's tech corridor.","languages":["English","Hindi","Kannada"]},
    {"name":"David Kim","cert":"PALC","location":"Sydney, Australia","country":"Australia","bio":"Professional coach working with government and non-profit organizations across Oceania.","languages":["English","Korean"]},
    {"name":"Sarah Mitchell","cert":"CALC","location":"Melbourne, Australia","country":"Australia","bio":"Certified coach focused on education sector leadership and university administration.","languages":["English"]},
    {"name":"Wei Zhang","cert":"SALC","location":"Shanghai, China","country":"China","bio":"资深教练，专注于中国制造业和科技行业的领导力发展。在跨文化团队建设方面拥有丰富经验。","languages":["Mandarin","English"]},
    {"name":"Min-Ji Park","cert":"PALC","location":"Seoul, South Korea","country":"South Korea","bio":"전문 코치로서 한국 대기업의 리더십 개발과 조직 변화를 전문으로 합니다.","languages":["Korean","English"]},
    {"name":"Nguyen Thi Lan","cert":"CALC","location":"Ho Chi Minh City, Vietnam","country":"Vietnam","bio":"Huấn luyện viên được chứng nhận tập trung vào phát triển lãnh đạo trong ngành sản xuất và xuất khẩu Việt Nam.","languages":["Vietnamese","English"]},
    {"name":"Arjun Patel","cert":"PALC","location":"New Delhi, India","country":"India","bio":"Professional coach working with Indian government agencies on public sector leadership transformation.","languages":["Hindi","English","Gujarati"]},
    {"name":"Siti Rahman","cert":"CALC","location":"Kuala Lumpur, Malaysia","country":"Malaysia","bio":"Jurulatih bertauliah yang memberi tumpuan kepada pembangunan kepimpinan dalam sektor perbankan dan kewangan Malaysia.","languages":["Malay","English"]},
    {"name":"Somchai Prasert","cert":"PALC","location":"Bangkok, Thailand","country":"Thailand","bio":"โค้ชมืออาชีพที่เชี่ยวชาญด้านการพัฒนาภาวะผู้นำในอุตสาหกรรมการท่องเที่ยวและการบริการ","languages":["Thai","English"]},
    # Africa
    {"name":"Amara Okafor","cert":"CALC","location":"Lagos, Nigeria","country":"Nigeria","bio":"Certified coach passionate about bringing Action Learning to emerging markets in Africa. Focuses on entrepreneurship.","languages":["English","Yoruba"]},
    {"name":"Kwame Asante","cert":"PALC","location":"Accra, Ghana","country":"Ghana","bio":"Professional coach working with West African businesses on leadership development and organizational growth.","languages":["English","Twi"]},
    {"name":"Fatima Al-Hassan","cert":"PALC","location":"Cape Town, South Africa","country":"South Africa","bio":"Professional coach focused on community development and social enterprise in Southern Africa.","languages":["English","Afrikaans","Zulu"]},
    {"name":"Thabo Molefe","cert":"SALC","location":"Johannesburg, South Africa","country":"South Africa","bio":"Senior coach specializing in mining and energy sector leadership development across Southern Africa.","languages":["English","Zulu","Sotho"]},
    {"name":"Amina Diallo","cert":"CALC","location":"Nairobi, Kenya","country":"Kenya","bio":"Kocha aliyeidhinishwa anayelenga maendeleo ya uongozi katika sekta ya teknolojia na ubunifu ya Afrika Mashariki.","languages":["Swahili","English"]},
    {"name":"Mohamed Hassan","cert":"PALC","location":"Cairo, Egypt","country":"Egypt","bio":"مدرب محترف متخصص في تطوير القيادة في قطاع البنوك والتمويل في الشرق الأوسط وشمال أفريقيا.","languages":["Arabic","English"]},
    # Middle East
    {"name":"Ali Al-Rashid","cert":"SALC","location":"Dubai, UAE","country":"UAE","bio":"مدرب أول متخصص في تطوير القيادة في قطاع النفط والغاز والعقارات في دول الخليج العربي.","languages":["Arabic","English"]},
    {"name":"Noor Khalil","cert":"CALC","location":"Riyadh, Saudi Arabia","country":"Saudi Arabia","bio":"مدربة معتمدة تركز على تمكين المرأة في القيادة وتطوير رأس المال البشري في رؤية 2030.","languages":["Arabic","English"]},
    {"name":"Leila Tehrani","cert":"PALC","location":"Tehran, Iran","country":"Iran","bio":"Professional coach working with Iranian businesses on organizational development and leadership in the technology sector.","languages":["Persian","English"]},
    # Oceania
    {"name":"Aroha Williams","cert":"CALC","location":"Auckland, New Zealand","country":"New Zealand","bio":"Certified coach integrating Māori leadership principles with Action Learning methodology for community organizations.","languages":["English","Māori"]},
    {"name":"Tane Mahuta","cert":"PALC","location":"Wellington, New Zealand","country":"New Zealand","bio":"Professional coach specializing in public sector leadership and indigenous community development in Aotearoa.","languages":["English","Māori"]},
]


def embed_batch(texts):
    """Embed up to 96 texts in one Cohere call."""
    body = json.dumps({"texts": texts, "model": "embed-multilingual-v3.0", "input_type": "search_document", "truncate": "END"}).encode()
    req = urllib.request.Request("https://api.cohere.com/v1/embed", data=body, method="POST")
    req.add_header("Authorization", f"Bearer {COHERE_KEY}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())["embeddings"]


def main():
    now = datetime.now(timezone.utc).isoformat()
    print(f"Seeding {len(COACHES)} coaches...")

    # Build embedding texts
    texts = [f"{c['name']} {c['location']} {c['bio']} {' '.join(c['languages'])}" for c in COACHES]

    # Embed in one batch (Cohere supports up to 96)
    print("Embedding all coaches via Cohere embed-multilingual-v3.0...")
    embeddings = embed_batch(texts)
    print(f"Got {len(embeddings)} embeddings (dim={len(embeddings[0])})")

    for i, c in enumerate(COACHES):
        cid = str(uuid.uuid4())
        emb = [Decimal(str(round(v, 6))) for v in embeddings[i]]
        table.put_item(Item={
            "PK": f"COACH#{cid}", "SK": "PROFILE",
            "coachId": cid, "cognitoUserId": "unlinked", "chapterId": CHAPTER_ID,
            "name": c["name"], "photoUrl": "", "certificationLevel": c["cert"],
            "location": c["location"], "country": c.get("country", ""),
            "contactInfo": "coach@example.com", "bio": c["bio"],
            "languages": c["languages"], "status": "active",
            "embeddingVersion": 1, "embedding": emb,
            "createdAt": now, "updatedAt": now,
        })
        print(f"  ✓ {c['name']} ({c['cert']}) — {c['country']}")

    print(f"\nDone! {len(COACHES)} coaches seeded with embeddings.")


if __name__ == "__main__":
    main()

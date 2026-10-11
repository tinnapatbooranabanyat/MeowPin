import type { Lang } from '../i18n'

/** แก้เนื้อหาข้อกำหนดเมื่อไหร่ให้เพิ่มเลขนี้ ผู้ใช้ทุกคนจะต้องกดยอมรับใหม่ */
export const TERMS_VERSION = 4
export const TERMS_UPDATED = '2026-10-11'

interface Section {
  title: string
  points: string[]
}

// ข้อความยาวแยกไว้ที่นี่แทนการใช้ t() ทีละประโยค
const TERMS: Record<Lang, Section[]> = {
  th: [
    {
      title: 'ปักหมุดอย่างรับผิดชอบ',
      points: [
        'ปักหมุดเฉพาะน้องแมวที่เจอจริง และใช้รูปที่คุณถ่ายเองหรือมีสิทธิ์ใช้',
        'ห้ามโพสต์เนื้อหาที่ทารุณสัตว์ หยาบคาย สแปม หรือหลอกลวง',
        'ห้ามใส่ข้อมูลส่วนตัวของผู้อื่น เช่น บ้านเลขที่ เบอร์โทร หรือรูปที่เห็นหน้าคนชัดเจน',
        'แมวที่มีเจ้าของ เราจะแสดงตำแหน่งแบบคร่าวๆ เพื่อความเป็นส่วนตัวของเจ้าของ',
      ],
    },
    {
      title: 'ความปลอดภัยของคุณและน้องแมว',
      points: [
        'เข้าหาน้องแมวอย่างนุ่มนวล ไม่ไล่จับ และไม่ให้อาหารที่เป็นอันตรายกับแมว',
        'ถ้าโดนข่วนหรือกัด ให้ล้างแผลและพบแพทย์ คุณรับผิดชอบความปลอดภัยของตัวเองเมื่อไปหาน้องแมว',
        'ข้อมูลในแอปมาจากผู้ใช้ด้วยกันและสรุปโดย AI บางส่วน อาจไม่ถูกต้องหรือไม่เป็นปัจจุบัน',
      ],
    },
    {
      title: 'ข้อมูลที่เราเก็บ',
      points: [
        'ชื่อ อีเมล และรูปโปรไฟล์จากบัญชี Google ของคุณ (อีเมลไม่แสดงต่อผู้อื่น)',
        'หมุด รูป และรีวิวที่คุณโพสต์จะเป็นข้อมูลสาธารณะ — เราลบข้อมูล EXIF (รวมถึงพิกัดในไฟล์) ออกจากรูปก่อนเก็บ',
        'คำอธิบายและรีวิวของน้องแมว (ไม่รวมชื่อผู้รีวิว) จะถูกส่งให้ Google Gemini เพื่อสรุปเป็นภาษาไทยและอังกฤษ',
        'รูปที่ใช้ปักหมุดและรูปในอัลบั้มจะถูกย่อและส่งให้ Google Gemini ตรวจว่าเป็นแมวจริง (ลบข้อมูล EXIF ออกก่อนแล้ว)',
        'เพื่อความปลอดภัยของบัญชี เราบันทึกอุปกรณ์ IP และตำแหน่งโดยประมาณ (ระดับเมือง) ทุกครั้งที่เข้าสู่ระบบ — คุณดูและสั่งออกจากระบบอุปกรณ์เหล่านี้ได้ที่เมนู “อุปกรณ์ที่เข้าสู่ระบบ”',
        'เราบันทึกกิจกรรมในแอป เช่น การเข้าสู่ระบบ ปักหมุด รีวิว เพิ่มรูป และการรายงาน ให้ผู้ดูแลระบบใช้ตรวจสอบการใช้งานที่ผิดปกติ',
      ],
    },
    {
      title: 'การดูแลชุมชน',
      points: [
        'ผู้ดูแลระบบอาจลบหมุด รูป หรือรีวิวที่ผิดข้อกำหนด และระงับบัญชีที่ทำผิดซ้ำ',
        'อยากลบบัญชีหรือข้อมูลของคุณ แจ้งได้ที่เมนู “รายงานปัญหา / เสนอไอเดีย”',
        'เราอาจปรับข้อกำหนดนี้ และจะขอให้คุณกดยอมรับอีกครั้งเมื่อมีการเปลี่ยนแปลง',
      ],
    },
  ],
  en: [
    {
      title: 'Pin responsibly',
      points: [
        'Only pin cats you have actually met, using photos you took or have the right to use.',
        'No animal cruelty, abusive language, spam or misleading content.',
        "Don't post other people's personal details, such as house numbers, phone numbers or photos where faces are clearly visible.",
        "For cats with an owner, we only show an approximate location to protect the owner's privacy.",
      ],
    },
    {
      title: 'Your safety and the cats’',
      points: [
        "Approach cats gently, don't chase them, and never feed them anything harmful.",
        'If you get scratched or bitten, wash the wound and see a doctor. You are responsible for your own safety when visiting cats.',
        'Information in the app comes from other users and is partly summarized by AI, so it may be inaccurate or out of date.',
      ],
    },
    {
      title: 'Data we collect',
      points: [
        'Your name, email and profile photo from your Google account (your email is never shown to others).',
        'Pins, photos and reviews you post are public. We strip EXIF data (including embedded location) from photos before storing them.',
        "Cat descriptions and reviews (without reviewers' names) are sent to Google Gemini to produce Thai and English summaries.",
        "Pin and album photos are resized and sent to Google Gemini to check that they show a real cat (with EXIF data already removed).",
        'To keep your account safe, we record the device, IP address and approximate (city-level) location of every sign-in. You can review these devices and sign them out under “Signed-in devices” in the menu.',
        'We log activity in the app, such as sign-ins, pins, reviews, photos and reports, so admins can spot abuse.',
      ],
    },
    {
      title: 'Community moderation',
      points: [
        'Admins may remove pins, photos or reviews that break these terms and suspend repeat offenders.',
        'To delete your account or data, use “Report a problem / Suggest an idea” in the menu.',
        "We may update these terms and will ask you to accept them again when they change.",
      ],
    },
  ],
}

export const termsFor = (lang: Lang) => TERMS[lang]

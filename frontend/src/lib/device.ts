// Android: input ที่รับแค่ image/* จะเปิด Photo Picker ซึ่งลบตำแหน่ง GPS ออกจากรูป
// input ที่ไม่ใส่ accept → Chrome ให้เลือกแอปเอง (แกลเลอรี/Google Photos/Files) ที่มีโอกาสได้ไฟล์ต้นฉบับพร้อมตำแหน่ง
export const isAndroid = /Android/i.test(navigator.userAgent)

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i

/** ไฟล์ที่เลือกผ่านช่องแบบไม่จำกัดชนิด ต้องเช็กเองว่าเป็นรูป */
export const isImageFile = (file: File) => file.type.startsWith('image/') || IMAGE_EXT.test(file.name)

import type { LearnLang } from "./languages";

export interface ShadowSentence {
  text: string;
  reading?: string;      // pinyin / kana / romanization for zh, ja, ko
  translation: string;   // Vietnamese
}

/** Sentences to listen to and repeat, 8 per language. English keeps the original workplace set. */
export const SHADOW_SENTENCES: Record<LearnLang, ShadowSentence[]> = {
  en: [
    { text: "The meeting has been postponed until next Thursday.", translation: "Cuộc họp đã được hoãn đến thứ Năm tuần sau." },
    { text: "Could you please send me the report by end of day?", translation: "Bạn có thể gửi tôi báo cáo trước cuối ngày được không?" },
    { text: "I'd like to schedule a conference call for tomorrow morning.", translation: "Tôi muốn lên lịch một cuộc gọi hội nghị vào sáng mai." },
    { text: "The quarterly results exceeded our expectations significantly.", translation: "Kết quả quý vượt xa kỳ vọng của chúng tôi." },
    { text: "We need to finalize the budget before the end of the month.", translation: "Chúng ta cần chốt ngân sách trước cuối tháng." },
    { text: "She apologized for the misunderstanding and offered a refund.", translation: "Cô ấy xin lỗi vì sự hiểu lầm và đề nghị hoàn tiền." },
    { text: "The proposal was well-received by the management team.", translation: "Đề xuất được ban quản lý đón nhận tích cực." },
    { text: "Please make sure to submit the application before the deadline.", translation: "Hãy nhớ nộp hồ sơ trước hạn chót." },
  ],
  zh: [
    { text: "你好，很高兴认识你。", reading: "Nǐ hǎo, hěn gāoxìng rènshi nǐ.", translation: "Xin chào, rất vui được gặp bạn." },
    { text: "请问洗手间在哪里？", reading: "Qǐngwèn xǐshǒujiān zài nǎlǐ?", translation: "Xin hỏi nhà vệ sinh ở đâu?" },
    { text: "这个多少钱？", reading: "Zhège duōshǎo qián?", translation: "Cái này bao nhiêu tiền?" },
    { text: "我想要一杯咖啡。", reading: "Wǒ xiǎng yào yì bēi kāfēi.", translation: "Tôi muốn một ly cà phê." },
    { text: "明天下午我们一起去吧。", reading: "Míngtiān xiàwǔ wǒmen yìqǐ qù ba.", translation: "Chiều mai chúng ta cùng đi nhé." },
    { text: "对不起，我听不懂。", reading: "Duìbuqǐ, wǒ tīng bu dǒng.", translation: "Xin lỗi, tôi nghe không hiểu." },
    { text: "你可以说慢一点吗？", reading: "Nǐ kěyǐ shuō màn yìdiǎn ma?", translation: "Bạn có thể nói chậm một chút không?" },
    { text: "谢谢你的帮助。", reading: "Xièxie nǐ de bāngzhù.", translation: "Cảm ơn sự giúp đỡ của bạn." },
  ],
  ja: [
    { text: "はじめまして、よろしくお願いします。", reading: "はじめまして、よろしくおねがいします。", translation: "Rất vui được gặp, mong được giúp đỡ." },
    { text: "トイレはどこですか。", reading: "といれはどこですか。", translation: "Nhà vệ sinh ở đâu ạ?" },
    { text: "これはいくらですか。", reading: "これはいくらですか。", translation: "Cái này bao nhiêu tiền?" },
    { text: "コーヒーを一つください。", reading: "こーひーをひとつください。", translation: "Cho tôi một ly cà phê." },
    { text: "明日の午後、一緒に行きましょう。", reading: "あしたのごご、いっしょにいきましょう。", translation: "Chiều mai cùng đi nhé." },
    { text: "すみません、よく分かりません。", reading: "すみません、よくわかりません。", translation: "Xin lỗi, tôi không hiểu lắm." },
    { text: "もう少しゆっくり話してください。", reading: "もうすこしゆっくりはなしてください。", translation: "Xin hãy nói chậm hơn một chút." },
    { text: "手伝ってくれてありがとう。", reading: "てつだってくれてありがとう。", translation: "Cảm ơn bạn đã giúp." },
  ],
  ko: [
    { text: "안녕하세요, 만나서 반갑습니다.", reading: "Annyeonghaseyo, mannaseo bangapseumnida.", translation: "Xin chào, rất vui được gặp bạn." },
    { text: "화장실이 어디에 있어요?", reading: "Hwajangsiri eodie isseoyo?", translation: "Nhà vệ sinh ở đâu ạ?" },
    { text: "이거 얼마예요?", reading: "Igeo eolmayeyo?", translation: "Cái này bao nhiêu tiền?" },
    { text: "커피 한 잔 주세요.", reading: "Keopi han jan juseyo.", translation: "Cho tôi một ly cà phê." },
    { text: "내일 오후에 같이 가요.", reading: "Naeil ohue gachi gayo.", translation: "Chiều mai cùng đi nhé." },
    { text: "죄송하지만 잘 모르겠어요.", reading: "Joesonghajiman jal moreugesseoyo.", translation: "Xin lỗi, tôi không hiểu lắm." },
    { text: "조금 천천히 말해 주세요.", reading: "Jogeum cheoncheonhi malhae juseyo.", translation: "Xin hãy nói chậm một chút." },
    { text: "도와주셔서 감사합니다.", reading: "Dowajusyeoseo gamsahamnida.", translation: "Cảm ơn bạn đã giúp đỡ." },
  ],
};

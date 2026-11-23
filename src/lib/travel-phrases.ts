import type { LearnLang } from "./languages";

/** [text, reading]: pinyin for zh, romaji for ja (travellers rarely read kana), romanization for ko. */
type Line = readonly [text: string, reading?: string];

export interface TravelPhrase {
  vi: string;
  en: Line;
  zh: Line;
  ja: Line;
  ko: Line;
}

/** Built-in phrasebook: no AI call, so it works offline. */
export const TRAVEL_PHRASES: { topic: string; phrases: TravelPhrase[] }[] = [
  {
    topic: "Chào hỏi",
    phrases: [
      { vi: "Xin chào", en: ["Hello"], zh: ["你好", "nǐ hǎo"], ja: ["こんにちは", "konnichiwa"], ko: ["안녕하세요", "annyeonghaseyo"] },
      { vi: "Cảm ơn", en: ["Thank you"], zh: ["谢谢", "xièxie"], ja: ["ありがとうございます", "arigatō gozaimasu"], ko: ["감사합니다", "gamsahamnida"] },
      { vi: "Xin lỗi, làm phiền một chút", en: ["Excuse me"], zh: ["不好意思", "bù hǎoyìsi"], ja: ["すみません", "sumimasen"], ko: ["실례합니다", "sillyehamnida"] },
      { vi: "Vâng / Không", en: ["Yes / No"], zh: ["是 / 不是", "shì / bú shì"], ja: ["はい / いいえ", "hai / iie"], ko: ["네 / 아니요", "ne / aniyo"] },
      { vi: "Tôi không hiểu", en: ["I don't understand"], zh: ["我听不懂", "wǒ tīng bu dǒng"], ja: ["わかりません", "wakarimasen"], ko: ["이해가 안 돼요", "ihaega an dwaeyo"] },
      { vi: "Bạn nói tiếng Anh được không?", en: ["Do you speak English?"], zh: ["你会说英语吗？", "nǐ huì shuō Yīngyǔ ma?"], ja: ["英語を話せますか？", "eigo o hanasemasu ka?"], ko: ["영어 할 줄 아세요?", "yeongeo hal jul aseyo?"] },
      { vi: "Làm ơn nói chậm lại", en: ["Please speak more slowly"], zh: ["请说慢一点", "qǐng shuō màn yìdiǎn"], ja: ["もう少しゆっくり話してください", "mō sukoshi yukkuri hanashite kudasai"], ko: ["천천히 말씀해 주세요", "cheoncheonhi malsseumhae juseyo"] },
      { vi: "Tôi đến từ Việt Nam", en: ["I'm from Vietnam"], zh: ["我来自越南", "wǒ láizì Yuènán"], ja: ["ベトナムから来ました", "Betonamu kara kimashita"], ko: ["베트남에서 왔어요", "beteunameseo wasseoyo"] },
    ],
  },
  {
    topic: "Đi lại",
    phrases: [
      { vi: "Nhà vệ sinh ở đâu?", en: ["Where is the restroom?"], zh: ["洗手间在哪里？", "xǐshǒujiān zài nǎlǐ?"], ja: ["トイレはどこですか？", "toire wa doko desu ka?"], ko: ["화장실이 어디예요?", "hwajangsiri eodiyeyo?"] },
      { vi: "Ga tàu ở đâu?", en: ["Where is the train station?"], zh: ["火车站在哪里？", "huǒchēzhàn zài nǎlǐ?"], ja: ["駅はどこですか？", "eki wa doko desu ka?"], ko: ["역이 어디예요?", "yeogi eodiyeyo?"] },
      { vi: "Trạm xe buýt ở đâu?", en: ["Where is the bus stop?"], zh: ["公交车站在哪里？", "gōngjiāochē zhàn zài nǎlǐ?"], ja: ["バス停はどこですか？", "basutei wa doko desu ka?"], ko: ["버스 정류장이 어디예요?", "beoseu jeongnyujangi eodiyeyo?"] },
      { vi: "Cho tôi đến địa chỉ này", en: ["Please take me to this address"], zh: ["请带我去这个地址", "qǐng dài wǒ qù zhège dìzhǐ"], ja: ["この住所までお願いします", "kono jūsho made onegaishimasu"], ko: ["이 주소로 가 주세요", "i jusoro ga juseyo"] },
      { vi: "Đến đó mất bao lâu?", en: ["How long does it take to get there?"], zh: ["到那里要多长时间？", "dào nàlǐ yào duō cháng shíjiān?"], ja: ["そこまでどのくらいかかりますか？", "soko made dono kurai kakarimasu ka?"], ko: ["거기까지 얼마나 걸려요?", "geogikkaji eolmana geollyeoyo?"] },
      { vi: "Tàu này có dừng ở … không?", en: ["Does this train stop at …?"], zh: ["这趟车在……停吗？", "zhè tàng chē zài … tíng ma?"], ja: ["この電車は…に止まりますか？", "kono densha wa … ni tomarimasu ka?"], ko: ["이 열차 …에 서요?", "i yeolcha …e seoyo?"] },
      { vi: "Cho tôi một vé đi …", en: ["One ticket to …, please"], zh: ["一张去……的票", "yì zhāng qù … de piào"], ja: ["…までの切符を一枚ください", "… made no kippu o ichimai kudasai"], ko: ["…까지 표 한 장 주세요", "…kkaji pyo han jang juseyo"] },
      { vi: "Tôi bị lạc đường", en: ["I'm lost"], zh: ["我迷路了", "wǒ mílù le"], ja: ["道に迷いました", "michi ni mayoimashita"], ko: ["길을 잃었어요", "gireul ireosseoyo"] },
    ],
  },
  {
    topic: "Ăn uống",
    phrases: [
      { vi: "Cho tôi xem thực đơn", en: ["The menu, please"], zh: ["请给我菜单", "qǐng gěi wǒ càidān"], ja: ["メニューをください", "menyū o kudasai"], ko: ["메뉴판 주세요", "menyupan juseyo"] },
      { vi: "Món này là gì?", en: ["What is this?"], zh: ["这是什么菜？", "zhè shì shénme cài?"], ja: ["これは何ですか？", "kore wa nan desu ka?"], ko: ["이건 뭐예요?", "igeon mwoyeyo?"] },
      { vi: "Cho tôi món này", en: ["I'd like this one, please"], zh: ["我要这个", "wǒ yào zhège"], ja: ["これをお願いします", "kore o onegaishimasu"], ko: ["이거 주세요", "igeo juseyo"] },
      { vi: "Đừng cho cay", en: ["Not spicy, please"], zh: ["不要辣", "bú yào là"], ja: ["辛くしないでください", "karaku shinaide kudasai"], ko: ["안 맵게 해 주세요", "an maepge hae juseyo"] },
      { vi: "Tôi bị dị ứng đậu phộng", en: ["I'm allergic to peanuts"], zh: ["我对花生过敏", "wǒ duì huāshēng guòmǐn"], ja: ["ピーナッツアレルギーがあります", "pīnattsu arerugī ga arimasu"], ko: ["땅콩 알레르기가 있어요", "ttangkong allereugiga isseoyo"] },
      { vi: "Tôi ăn chay", en: ["I'm vegetarian"], zh: ["我吃素", "wǒ chī sù"], ja: ["ベジタリアンです", "bejitarian desu"], ko: ["저는 채식주의자예요", "jeoneun chaesikjuuijayeyo"] },
      { vi: "Cho tôi nước lọc", en: ["Water, please"], zh: ["请给我一杯水", "qǐng gěi wǒ yì bēi shuǐ"], ja: ["お水をください", "omizu o kudasai"], ko: ["물 좀 주세요", "mul jom juseyo"] },
      { vi: "Tính tiền giúp tôi", en: ["The bill, please"], zh: ["买单", "mǎidān"], ja: ["お会計お願いします", "okaikei onegaishimasu"], ko: ["계산해 주세요", "gyesanhae juseyo"] },
    ],
  },
  {
    topic: "Khách sạn",
    phrases: [
      { vi: "Tôi đã đặt phòng", en: ["I have a reservation"], zh: ["我有预订", "wǒ yǒu yùdìng"], ja: ["予約しています", "yoyaku shite imasu"], ko: ["예약했어요", "yeyakhaesseoyo"] },
      { vi: "Mấy giờ trả phòng?", en: ["What time is check-out?"], zh: ["几点退房？", "jǐ diǎn tuìfáng?"], ja: ["チェックアウトは何時ですか？", "chekkuauto wa nanji desu ka?"], ko: ["체크아웃은 몇 시예요?", "chekeuauseun myeot siyeyo?"] },
      { vi: "Bữa sáng lúc mấy giờ?", en: ["What time is breakfast?"], zh: ["早餐几点？", "zǎocān jǐ diǎn?"], ja: ["朝食は何時ですか？", "chōshoku wa nanji desu ka?"], ko: ["아침 식사는 몇 시예요?", "achim siksaneun myeot siyeyo?"] },
      { vi: "Mật khẩu Wi-Fi là gì?", en: ["What's the Wi-Fi password?"], zh: ["Wi-Fi密码是多少？", "Wi-Fi mìmǎ shì duōshao?"], ja: ["Wi-Fiのパスワードは何ですか？", "waifai no pasuwādo wa nan desu ka?"], ko: ["와이파이 비밀번호가 뭐예요?", "waipai bimilbeonhoga mwoyeyo?"] },
      { vi: "Tôi gửi hành lý ở đây được không?", en: ["Can I leave my luggage here?"], zh: ["可以寄存行李吗？", "kěyǐ jìcún xíngli ma?"], ja: ["荷物を預かってもらえますか？", "nimotsu o azukatte moraemasu ka?"], ko: ["짐을 맡길 수 있어요?", "jimeul matgil su isseoyo?"] },
      { vi: "Điều hoà phòng tôi bị hỏng", en: ["The air conditioner in my room is broken"], zh: ["我房间的空调坏了", "wǒ fángjiān de kōngtiáo huài le"], ja: ["部屋のエアコンが壊れています", "heya no eakon ga kowarete imasu"], ko: ["방 에어컨이 고장 났어요", "bang eeokeoni gojang nasseoyo"] },
      { vi: "Cho tôi thêm khăn tắm", en: ["Could I have more towels?"], zh: ["请再给我几条毛巾", "qǐng zài gěi wǒ jǐ tiáo máojīn"], ja: ["タオルをもう少しください", "taoru o mō sukoshi kudasai"], ko: ["수건 좀 더 주세요", "sugeon jom deo juseyo"] },
      { vi: "Gọi taxi giúp tôi", en: ["Could you call a taxi for me?"], zh: ["能帮我叫一辆出租车吗？", "néng bāng wǒ jiào yí liàng chūzūchē ma?"], ja: ["タクシーを呼んでもらえますか？", "takushī o yonde moraemasu ka?"], ko: ["택시 좀 불러 주세요", "taeksi jom bulleo juseyo"] },
    ],
  },
  {
    topic: "Mua sắm",
    phrases: [
      { vi: "Cái này bao nhiêu tiền?", en: ["How much is this?"], zh: ["这个多少钱？", "zhège duōshao qián?"], ja: ["これはいくらですか？", "kore wa ikura desu ka?"], ko: ["이거 얼마예요?", "igeo eolmayeyo?"] },
      { vi: "Bớt chút được không?", en: ["Can you give me a discount?"], zh: ["能便宜一点吗？", "néng piányi yìdiǎn ma?"], ja: ["安くなりますか？", "yasuku narimasu ka?"], ko: ["좀 깎아 주세요", "jom kkakka juseyo"] },
      { vi: "Trả bằng thẻ được không?", en: ["Can I pay by card?"], zh: ["可以刷卡吗？", "kěyǐ shuā kǎ ma?"], ja: ["カードで払えますか？", "kādo de haraemasu ka?"], ko: ["카드로 계산돼요?", "kadeuro gyesandwaeyo?"] },
      { vi: "Tôi chỉ xem thôi", en: ["I'm just looking"], zh: ["我只是看看", "wǒ zhǐshì kànkan"], ja: ["見ているだけです", "mite iru dake desu"], ko: ["그냥 구경하는 거예요", "geunyang gugyeonghaneun geoyeyo"] },
      { vi: "Có cỡ lớn hơn không?", en: ["Do you have a bigger size?"], zh: ["有大一号的吗？", "yǒu dà yí hào de ma?"], ja: ["もっと大きいサイズはありますか？", "motto ōkii saizu wa arimasu ka?"], ko: ["더 큰 사이즈 있어요?", "deo keun saijeu isseoyo?"] },
      { vi: "Tôi lấy cái này", en: ["I'll take this"], zh: ["我买这个", "wǒ mǎi zhège"], ja: ["これにします", "kore ni shimasu"], ko: ["이걸로 할게요", "igeollo halgeyo"] },
      { vi: "Cho tôi hoá đơn", en: ["Could I have a receipt?"], zh: ["请给我收据", "qǐng gěi wǒ shōujù"], ja: ["レシートをください", "reshīto o kudasai"], ko: ["영수증 주세요", "yeongsujeung juseyo"] },
      { vi: "Có được miễn thuế không?", en: ["Is this tax-free?"], zh: ["可以免税吗？", "kěyǐ miǎnshuì ma?"], ja: ["免税できますか？", "menzei dekimasu ka?"], ko: ["면세 되나요?", "myeonse doenayo?"] },
    ],
  },
  {
    topic: "Khẩn cấp",
    phrases: [
      { vi: "Cứu tôi với!", en: ["Help!"], zh: ["救命！", "jiùmìng!"], ja: ["助けて！", "tasukete!"], ko: ["도와주세요!", "dowajuseyo!"] },
      { vi: "Gọi cảnh sát giúp tôi!", en: ["Call the police!"], zh: ["快叫警察！", "kuài jiào jǐngchá!"], ja: ["警察を呼んでください！", "keisatsu o yonde kudasai!"], ko: ["경찰을 불러 주세요!", "gyeongchareul bulleo juseyo!"] },
      { vi: "Gọi xe cấp cứu giúp tôi!", en: ["Call an ambulance!"], zh: ["快叫救护车！", "kuài jiào jiùhùchē!"], ja: ["救急車を呼んでください！", "kyūkyūsha o yonde kudasai!"], ko: ["구급차를 불러 주세요!", "gugeupchareul bulleo juseyo!"] },
      { vi: "Tôi thấy không khoẻ", en: ["I don't feel well"], zh: ["我不舒服", "wǒ bù shūfu"], ja: ["気分が悪いです", "kibun ga warui desu"], ko: ["몸이 안 좋아요", "momi an joayo"] },
      { vi: "Bệnh viện gần nhất ở đâu?", en: ["Where is the nearest hospital?"], zh: ["最近的医院在哪里？", "zuì jìn de yīyuàn zài nǎlǐ?"], ja: ["一番近い病院はどこですか？", "ichiban chikai byōin wa doko desu ka?"], ko: ["가장 가까운 병원이 어디예요?", "gajang gakkaun byeongwoni eodiyeyo?"] },
      { vi: "Hiệu thuốc ở đâu?", en: ["Where is the pharmacy?"], zh: ["药店在哪里？", "yàodiàn zài nǎlǐ?"], ja: ["薬局はどこですか？", "yakkyoku wa doko desu ka?"], ko: ["약국이 어디예요?", "yakgugi eodiyeyo?"] },
      { vi: "Tôi bị mất hộ chiếu", en: ["I lost my passport"], zh: ["我的护照丢了", "wǒ de hùzhào diū le"], ja: ["パスポートをなくしました", "pasupōto o nakushimashita"], ko: ["여권을 잃어버렸어요", "yeogwoneul ireobeoryeosseoyo"] },
      { vi: "Tôi bị mất ví", en: ["I lost my wallet"], zh: ["我的钱包丢了", "wǒ de qiánbāo diū le"], ja: ["財布をなくしました", "saifu o nakushimashita"], ko: ["지갑을 잃어버렸어요", "jigabeul ireobeoryeosseoyo"] },
    ],
  },
];

export const PHRASE_LANGS: readonly LearnLang[] = ["en", "zh", "ja", "ko"];

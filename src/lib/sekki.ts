// 二十四節気・七十二候（略本暦）。固定の日付表は持たず、太陽の視黄経から求める。
// 暦の慣例どおり「その節気・候に入る瞬間を含む JST の日」からその節気・候とする。
import { jstDateString } from './sky';

export interface Kou { name: string; reading: string }
export interface Sekki { name: string; reading: string; kou: readonly [Kou, Kou, Kou] }
export interface SekkiOfDay {
  /** 0=立春 … 23=大寒 */
  index: number;
  name: string;
  reading: string;
  /** 0〜71（立春初候=0） */
  kouIndex: number;
  kou: Kou;
}

const k = (name: string, reading: string): Kou => ({ name, reading });

export const SEKKI: readonly Sekki[] = [
  { name: '立春', reading: 'りっしゅん', kou: [k('東風解凍', 'はるかぜこおりをとく'), k('黄鶯睍睆', 'うぐいすなく'), k('魚上氷', 'うおこおりをいずる')] },
  { name: '雨水', reading: 'うすい', kou: [k('土脉潤起', 'つちのしょううるおいおこる'), k('霞始靆', 'かすみはじめてたなびく'), k('草木萌動', 'そうもくめばえいずる')] },
  { name: '啓蟄', reading: 'けいちつ', kou: [k('蟄虫啓戸', 'すごもりむしとをひらく'), k('桃始笑', 'ももはじめてさく'), k('菜虫化蝶', 'なむしちょうとなる')] },
  { name: '春分', reading: 'しゅんぶん', kou: [k('雀始巣', 'すずめはじめてすくう'), k('桜始開', 'さくらはじめてひらく'), k('雷乃発声', 'かみなりすなわちこえをはっす')] },
  { name: '清明', reading: 'せいめい', kou: [k('玄鳥至', 'つばめきたる'), k('鴻雁北', 'こうがんかえる'), k('虹始見', 'にじはじめてあらわる')] },
  { name: '穀雨', reading: 'こくう', kou: [k('葭始生', 'あしはじめてしょうず'), k('霜止出苗', 'しもやんでなえいずる'), k('牡丹華', 'ぼたんはなさく')] },
  { name: '立夏', reading: 'りっか', kou: [k('蛙始鳴', 'かわずはじめてなく'), k('蚯蚓出', 'みみずいずる'), k('竹笋生', 'たけのこしょうず')] },
  { name: '小満', reading: 'しょうまん', kou: [k('蚕起食桑', 'かいこおきてくわをはむ'), k('紅花栄', 'べにばなさかう'), k('麦秋至', 'むぎのときいたる')] },
  { name: '芒種', reading: 'ぼうしゅ', kou: [k('蟷螂生', 'かまきりしょうず'), k('腐草為螢', 'くされたるくさほたるとなる'), k('梅子黄', 'うめのみきばむ')] },
  { name: '夏至', reading: 'げし', kou: [k('乃東枯', 'なつかれくさかるる'), k('菖蒲華', 'あやめはなさく'), k('半夏生', 'はんげしょうず')] },
  { name: '小暑', reading: 'しょうしょ', kou: [k('温風至', 'あつかぜいたる'), k('蓮始開', 'はすはじめてひらく'), k('鷹乃学習', 'たかすなわちわざをならう')] },
  { name: '大暑', reading: 'たいしょ', kou: [k('桐始結花', 'きりはじめてはなをむすぶ'), k('土潤溽暑', 'つちうるおうてむしあつし'), k('大雨時行', 'たいうときどきふる')] },
  { name: '立秋', reading: 'りっしゅう', kou: [k('涼風至', 'すずかぜいたる'), k('寒蝉鳴', 'ひぐらしなく'), k('蒙霧升降', 'ふかききりまとう')] },
  { name: '処暑', reading: 'しょしょ', kou: [k('綿柎開', 'わたのはなしべひらく'), k('天地始粛', 'てんちはじめてさむし'), k('禾乃登', 'こくものすなわちみのる')] },
  { name: '白露', reading: 'はくろ', kou: [k('草露白', 'くさのつゆしろし'), k('鶺鴒鳴', 'せきれいなく'), k('玄鳥去', 'つばめさる')] },
  { name: '秋分', reading: 'しゅうぶん', kou: [k('雷乃収声', 'かみなりすなわちこえをおさむ'), k('蟄虫坏戸', 'むしかくれてとをふさぐ'), k('水始涸', 'みずはじめてかるる')] },
  { name: '寒露', reading: 'かんろ', kou: [k('鴻雁来', 'こうがんきたる'), k('菊花開', 'きくのはなひらく'), k('蟋蟀在戸', 'きりぎりすとにあり')] },
  { name: '霜降', reading: 'そうこう', kou: [k('霜始降', 'しもはじめてふる'), k('霎時施', 'こさめときどきふる'), k('楓蔦黄', 'もみじつたきばむ')] },
  { name: '立冬', reading: 'りっとう', kou: [k('山茶始開', 'つばきはじめてひらく'), k('地始凍', 'ちはじめてこおる'), k('金盞香', 'きんせんかさく')] },
  { name: '小雪', reading: 'しょうせつ', kou: [k('虹蔵不見', 'にじかくれてみえず'), k('朔風払葉', 'きたかぜこのはをはらう'), k('橘始黄', 'たちばなはじめてきばむ')] },
  { name: '大雪', reading: 'たいせつ', kou: [k('閉塞成冬', 'そらさむくふゆとなる'), k('熊蟄穴', 'くまあなにこもる'), k('鱖魚群', 'さけのうおむらがる')] },
  { name: '冬至', reading: 'とうじ', kou: [k('乃東生', 'なつかれくさしょうず'), k('麋角解', 'さわしかのつのおつる'), k('雪下出麦', 'ゆきわたりてむぎのびる')] },
  { name: '小寒', reading: 'しょうかん', kou: [k('芹乃栄', 'せりすなわちさかう'), k('水泉動', 'しみずあたたかをふくむ'), k('雉始雊', 'きじはじめてなく')] },
  { name: '大寒', reading: 'だいかん', kou: [k('款冬華', 'ふきのはなさく'), k('水沢腹堅', 'さわみずこおりつめる'), k('鶏始乳', 'にわとりはじめてとやにつく')] },
];

const RAD = Math.PI / 180;

/** 太陽の視黄経（度, 0〜360）。Meeus の簡易式（誤差 約0.01°＝約15分）。 */
export function solarLongitude(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m * RAD)
    + (0.019993 - 0.000101 * t) * Math.sin(2 * m * RAD)
    + 0.000289 * Math.sin(3 * m * RAD);
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  return ((lambda % 360) + 360) % 360;
}

/** その JST 暦日の節気・候（その日のうちに入るものを含む＝日の終わり時点で判定） */
export function sekkiForDate(now: Date): SekkiOfDay {
  const [y, mo, d] = jstDateString(now).split('-').map(Number);
  // JST 23:59:59.999 = 同日 UTC 14:59:59.999
  const endOfDay = new Date(Date.UTC(y, mo - 1, d, 15, 0, 0) - 1);
  const offset = (solarLongitude(endOfDay) - 315 + 360) % 360; // 立春(315°)起点
  const kouIndex = Math.floor(offset / 5);
  const index = Math.floor(kouIndex / 3);
  const s = SEKKI[index];
  return { index, name: s.name, reading: s.reading, kouIndex, kou: s.kou[kouIndex % 3] };
}

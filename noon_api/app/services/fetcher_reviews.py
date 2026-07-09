"""
NOON 商品评论抓取与深度分析服务

使用 Playwright 无头浏览器绕过 Akamai Bot Manager，
在浏览器上下文中调用 NOON 内部 reviews API 获取单条评论，
并对评论做深度分析（评分分布、文本情感、优缺点关键词、评论质量、时间趋势等）。
"""
import asyncio
import json
import logging
import re
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List

from curl_cffi import requests as cffi_requests
from bs4 import BeautifulSoup
from deep_translator import GoogleTranslator

logger = logging.getLogger(__name__)

_STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "must", "shall", "can", "need", "dare", "ought", "used",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
    "my", "your", "his", "her", "its", "our", "their", "this", "that", "these", "those",
    "and", "but", "or", "yet", "so", "for", "nor", "as", "because", "since", "until",
    "while", "of", "at", "by", "with", "about", "against", "between", "into", "through",
    "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out",
    "on", "off", "over", "under", "again", "further", "then", "once", "here", "there",
    "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most",
    "other", "some", "such", "no", "not", "only", "own", "same", "than", "too", "very",
    "just", "now", "also", "really", "one", "two", "three", "get", "got", "like",
    "product", "item", "noon", "buy", "bought",
    "ordered", "order", "delivery", "delivered", "received", "purchase", "seller",
    "its", "wasnt", "werent", "dont", "doesnt", "didnt", "wont", "wouldnt", "couldnt",
    "shouldnt", "isnt", "arent", "im", "ive", "youre", "theyre", "thats", "theres",
}

_POSITIVE_WORDS = {
    "good", "great", "excellent", "amazing", "awesome", "perfect", "love", "loved",
    "best", "wonderful", "fantastic", "superb", "brilliant", "outstanding", "nice",
    "happy", "pleased", "satisfied", "recommend", "recommended", "worth", "quality",
    "comfortable", "easy", "fast", "beautiful", "well", "better", "fine", "cool",
    "impressed", "impressive", "solid", "durable", "reliable", "efficient", "powerful",
    "quiet", "lightweight", "strong", "smooth", "soft", "sturdy", "helpful", "convenient",
    "affordable", "cheap", "value", "stylish", "elegant", "compact", "portable",
}

_NEGATIVE_WORDS = {
    "bad", "terrible", "horrible", "awful", "poor", "worst", "hate", "hated",
    "disappointed", "disappointing", "waste", "broken", "defective", "useless",
    "cheap", "flimsy", "weak", "slow", "noisy", "loud", "heavy", "hard",
    "difficult", "uncomfortable", "unreliable", "stopped", "broke", "break",
    "breaking", "damaged", "damage", "return", "returned", "refund", "refunded",
    "complaint", "complain", "problem", "issue", "issues", "fail", "failed",
    "failure", "missing", "wrong", "error", "never", "worse", "overpriced",
    "expensive", "unacceptable", "frustrating", "annoying", "misleading",
}

_TRANSLATION_DICT = {
    "good": "好", "great": "很棒", "excellent": "优秀", "amazing": "惊艳", "awesome": "极好", "perfect": "完美", "love": "喜欢", "loved": "喜爱",
    "best": "最好", "wonderful": "精彩", "fantastic": "奇妙", "superb": "一流", "brilliant": "卓越", "outstanding": "杰出", "nice": "不错",
    "happy": "开心", "pleased": "满意", "satisfied": "满足", "recommend": "推荐", "recommended": "推荐", "worth": "值得", "quality": "质量好",
    "comfortable": "舒适", "easy": "简单", "fast": "快速", "beautiful": "漂亮", "well": "很好", "better": "更好", "fine": "好", "cool": "酷",
    "impressed": "印象深刻", "impressive": "令人印象深刻", "solid": "结实", "durable": "耐用", "reliable": "可靠", "efficient": "高效", "powerful": "强大",
    "quiet": "安静", "lightweight": "轻便", "strong": "强劲", "smooth": "顺滑", "soft": "柔软", "sturdy": "坚固", "helpful": "有用", "convenient": "方便",
    "affordable": "实惠", "cheap": "便宜", "value": "超值", "stylish": "时尚", "elegant": "优雅", "compact": "紧凑", "portable": "便携",
    "bad": "差", "terrible": "糟糕", "horrible": "可怕", "awful": "极差", "poor": "劣质", "worst": "最差", "hate": "讨厌", "hated": "极其讨厌",
    "disappointed": "失望", "disappointing": "令人失望", "waste": "浪费", "broken": "损坏", "defective": "有缺陷", "useless": "没用",
    "flimsy": "脆弱", "weak": "弱", "slow": "慢", "noisy": "噪音大", "loud": "吵闹", "heavy": "重", "hard": "硬",
    "difficult": "困难", "uncomfortable": "不舒服", "unreliable": "不可靠", "stopped": "停止工作", "broke": "坏了", "break": "破损",
    "breaking": "容易坏", "damaged": "损坏", "damage": "损坏", "return": "退货", "returned": "已退货", "refund": "退款", "refunded": "已退款",
    "complaint": "投诉", "complain": "抱怨", "problem": "问题", "issue": "缺陷", "issues": "问题多", "fail": "失败", "failed": "失效",
    "failure": "故障", "missing": "缺失", "wrong": "错误", "error": "报错", "never": "绝不", "worse": "更糟", "overpriced": "价格虚高",
    "expensive": "昂贵", "unacceptable": "无法接受", "frustrating": "令人沮丧", "annoying": "烦人", "misleading": "误导",
    "price": "价格", "battery": "电池", "screen": "屏幕", "camera": "相机", "sound": "声音", "design": "设计", "size": "尺寸", "color": "颜色",
    "material": "材质", "weight": "重量", "delivery": "物流", "service": "服务", "packaging": "包装", "box": "盒子", "cable": "线缆",
    "charger": "充电器", "case": "外壳", "phone": "手机", "watch": "手表", "headphone": "耳机", "earbuds": "蓝牙耳机", "speaker": "音箱",
    "look": "外观", "looks": "外观", "fit": "贴合度", "fitting": "合身", "feel": "手感", "feeling": "手感", "smell": "气味", "taste": "味道",
    "use": "使用", "using": "使用中", "work": "工作", "working": "运作", "money": "钱", "time": "时间", "day": "天", "month": "月", "year": "年",
}


def _to_int(value: Any) -> int:
    if value is None:
        return 0
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return 0


def _to_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _to_timestamp(value: Any) -> int | None:
    """把 NOON 返回的时间戳统一转换为秒级整数。"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # 毫秒级时间戳
        if value > 1e11:
            return int(value / 1000)
        return int(value)
    if isinstance(value, str):
        # ISO 8601
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return int(dt.timestamp())
        except Exception:
            pass
        # 纯数字字符串
        try:
            ts = float(value)
            if ts > 1e11:
                return int(ts / 1000)
            return int(ts)
        except Exception:
            return None
    return None


def _normalize_review(raw: Dict[str, Any]) -> Dict[str, Any]:
    """把 NOON reviews API 返回的各种字段名统一成前端需要的格式。"""
    return {
        "rating": max(1, min(5, _to_int(raw.get("rating")))),
        "title": _to_str(raw.get("title")),
        "body": _to_str(raw.get("body") or raw.get("review") or raw.get("text")),
        "created_at": _to_timestamp(raw.get("created_at") or raw.get("createdAt")),
        "author": _to_str(raw.get("author") or raw.get("user") or raw.get("reviewer")),
        "helpful_count": _to_int(raw.get("helpful_count") or raw.get("helpfulCount")),
        "verified": bool(raw.get("verified") or raw.get("isVerified")),
    }


def _extract_words(text: str) -> List[str]:
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return [
        w.strip() for w in text.split()
        if len(w.strip()) >= 3 and w.strip() not in _STOP_WORDS and not w.strip().isdigit()
    ]


def _text_sentiment(text: str) -> str:
    pos_hits = sum(1 for w in _extract_words(text) if w in _POSITIVE_WORDS)
    neg_hits = sum(1 for w in _extract_words(text) if w in _NEGATIVE_WORDS)
    if pos_hits > neg_hits:
        return "positive"
    elif neg_hits > pos_hits:
        return "negative"
    return "neutral"


def analyze_reviews(reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
    """对评论列表做深度分析：评分分布、文本情感、优缺点关键词、评论质量、时间趋势等。"""
    empty_analysis = {
        "rating_distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
        "average_rating": 0.0,
        "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
        "text_sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
        "top_keywords": [],
        "pros_keywords": [],
        "cons_keywords": [],
        "timeline": [],
        "sentiment_timeline": [],
        "verified_ratio": None,
        "avg_review_length": 0.0,
        "review_length_distribution": {"short": 0, "medium": 0, "long": 0},
        "rating_reliability": None,
        "summary": "",
    }

    if not reviews:
        return empty_analysis

    rating_distribution = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    sentiment_distribution = {"positive": 0, "neutral": 0, "negative": 0}
    text_sentiment_distribution = {"positive": 0, "neutral": 0, "negative": 0}
    total_rating = 0
    verified_count = 0
    word_counter: Counter = Counter()
    pos_word_counter: Counter = Counter()
    neg_word_counter: Counter = Counter()
    date_counter: Counter = Counter()
    date_sentiment: Dict[str, Dict[str, int]] = {}
    total_length = 0
    length_dist = {"short": 0, "medium": 0, "long": 0}
    rating_mismatch_count = 0

    for r in reviews:
        rating = max(1, min(5, _to_int(r.get("rating"))))
        rating_distribution[str(rating)] += 1
        total_rating += rating

        if rating >= 4:
            sentiment_distribution["positive"] += 1
        elif rating == 3:
            sentiment_distribution["neutral"] += 1
        else:
            sentiment_distribution["negative"] += 1

        if r.get("verified"):
            verified_count += 1

        text = f"{r.get('title', '')} {r.get('body', '')}"
        words = _extract_words(text)
        for word in words:
            word_counter[word] += 1

        text_sent = _text_sentiment(text)
        text_sentiment_distribution[text_sent] += 1

        if (rating >= 4 and text_sent == "negative") or (rating <= 2 and text_sent == "positive"):
            rating_mismatch_count += 1

        if text_sent == "positive" or rating >= 4:
            for word in words:
                if word in _POSITIVE_WORDS:
                    pos_word_counter[word] += 1
        if text_sent == "negative" or rating <= 2:
            for word in words:
                if word in _NEGATIVE_WORDS:
                    neg_word_counter[word] += 1

        body_len = len(r.get("body", "") or "")
        total_length += body_len
        if body_len < 50:
            length_dist["short"] += 1
        elif body_len < 200:
            length_dist["medium"] += 1
        else:
            length_dist["long"] += 1

        created_at = r.get("created_at")
        if created_at:
            try:
                date_str = datetime.fromtimestamp(int(created_at)).strftime("%Y-%m-%d")
                date_counter[date_str] += 1
                if date_str not in date_sentiment:
                    date_sentiment[date_str] = {"positive": 0, "neutral": 0, "negative": 0}
                date_sentiment[date_str][text_sent] += 1
            except Exception:
                pass

    average_rating = round(total_rating / len(reviews), 2)

    top_keywords = [
        {"word": word, "count": count}
        for word, count in word_counter.most_common(15)
    ]

    pros_keywords = [
        {"word": word, "count": count}
        for word, count in pos_word_counter.most_common(10)
    ]

    cons_keywords = [
        {"word": word, "count": count}
        for word, count in neg_word_counter.most_common(10)
    ]

    timeline = [
        {"date": date, "count": count}
        for date, count in sorted(date_counter.items())
    ]

    sentiment_timeline = [
        {
            "date": date,
            "positive": sentiments.get("positive", 0),
            "neutral": sentiments.get("neutral", 0),
            "negative": sentiments.get("negative", 0),
        }
        for date, sentiments in sorted(date_sentiment.items())
    ]

    verified_ratio = None
    if any(r.get("verified") is not None for r in reviews):
        verified_ratio = round(verified_count / len(reviews), 2)

    avg_review_length = round(total_length / len(reviews), 1)

    rating_reliability = None
    if len(reviews) >= 5:
        mismatch_ratio = rating_mismatch_count / len(reviews)
        rating_reliability = round(max(0, 1 - mismatch_ratio * 2), 2)

    summary = _generate_summary(
        count=len(reviews),
        average_rating=average_rating,
        sentiment_distribution=sentiment_distribution,
        text_sentiment_distribution=text_sentiment_distribution,
        pros_keywords=pros_keywords,
        cons_keywords=cons_keywords,
        verified_ratio=verified_ratio,
        rating_reliability=rating_reliability,
    )

    return {
        "rating_distribution": rating_distribution,
        "average_rating": average_rating,
        "sentiment_distribution": sentiment_distribution,
        "text_sentiment_distribution": text_sentiment_distribution,
        "top_keywords": top_keywords,
        "pros_keywords": pros_keywords,
        "cons_keywords": cons_keywords,
        "timeline": timeline,
        "sentiment_timeline": sentiment_timeline,
        "verified_ratio": verified_ratio,
        "avg_review_length": avg_review_length,
        "review_length_distribution": length_dist,
        "rating_reliability": rating_reliability,
        "summary": summary,
    }


def _generate_summary(
    count: int,
    average_rating: float,
    sentiment_distribution: Dict[str, int],
    text_sentiment_distribution: Dict[str, int],
    pros_keywords: List[Dict[str, Any]],
    cons_keywords: List[Dict[str, Any]],
    verified_ratio: float | None,
    rating_reliability: float | None,
) -> str:
    total = sum(sentiment_distribution.values()) or 1
    pos_pct = round(sentiment_distribution["positive"] / total * 100)
    neg_pct = round(sentiment_distribution["negative"] / total * 100)

    text_total = sum(text_sentiment_distribution.values()) or 1
    text_pos_pct = round(text_sentiment_distribution["positive"] / text_total * 100)

    parts = [f"共 {count} 条评论，平均评分 {average_rating}。"]

    if pos_pct >= 70:
        parts.append(f"评分好评率高达 {pos_pct}%，整体口碑优秀。")
    elif pos_pct >= 50:
        parts.append(f"评分好评率 {pos_pct}%，口碑中等偏上。")
    elif neg_pct >= 40:
        parts.append(f"差评率 {neg_pct}%，口碑较差，需关注。")
    else:
        parts.append(f"好评率 {pos_pct}%，口碑一般。")

    if text_pos_pct != pos_pct:
        if text_pos_pct > pos_pct:
            parts.append(f"文本情感分析显示好评占比 {text_pos_pct}%，高于评分好评率，用户文字表达更积极。")
        else:
            parts.append(f"文本情感分析显示好评占比 {text_pos_pct}%，低于评分好评率，部分高评分评论文字含负面情绪。")

    if pros_keywords:
        top_pros = "、".join(k["word"] for k in pros_keywords[:5])
        parts.append(f"用户主要认可：{top_pros}。")

    if cons_keywords:
        top_cons = "、".join(k["word"] for k in cons_keywords[:5])
        parts.append(f"主要吐槽点：{top_cons}。")

    if verified_ratio is not None:
        if verified_ratio >= 0.7:
            parts.append(f"Verified 购买者占比 {round(verified_ratio*100)}%，评论可信度高。")
        elif verified_ratio >= 0.4:
            parts.append(f"Verified 购买者占比 {round(verified_ratio*100)}%，可信度中等。")
        else:
            parts.append(f"Verified 购买者仅占 {round(verified_ratio*100)}%，评论真实性存疑。")

    if rating_reliability is not None:
        if rating_reliability >= 0.8:
            parts.append("评分与文本情感一致性高，评分可靠。")
        elif rating_reliability >= 0.5:
            parts.append("部分评论评分与文字情感不一致，评分参考性一般。")
        else:
            parts.append("评分与文字情感矛盾较多，评分参考价值低。")

    return "".join(parts)


def _get_translator() -> GoogleTranslator:
    return GoogleTranslator(source='auto', target='zh-CN')


def _translate_word(word: str, translator: GoogleTranslator) -> str:
    """优先使用本地词典，失败再调用 Google 翻译。"""
    zh = _TRANSLATION_DICT.get(word)
    if zh:
        return zh
    try:
        return translator.translate(word) or word
    except Exception:
        return word


def _translate_reviews(reviews: List[Dict[str, Any]]) -> None:
    """把评论标题和正文翻译为中文（原地修改）。"""
    if not reviews:
        return
    translator = _get_translator()
    for r in reviews:
        if r.get("title"):
            r["title"] = _translate_word(r["title"], translator)
        if r.get("body"):
            r["body"] = _translate_word(r["body"], translator)


def _translate_analysis(analysis: Dict[str, Any]) -> None:
    """把分析结果中的关键词翻译为中文（原地修改）。"""
    translator = _get_translator()
    for kw_list in [analysis.get("top_keywords", []),
                    analysis.get("pros_keywords", []),
                    analysis.get("cons_keywords", [])]:
        for kw in kw_list:
            word = kw.get("word", "")
            kw["word"] = _translate_word(word, translator)


async def _fetch_raw_reviews(sku: str, limit: int = 50) -> Dict[str, Any]:
    """用 curl_cffi firefox 指纹抓商品页，从 JSON-LD 提取原始英文评论。

    返回结构：
    {
        "status": "success" | "intercepted" | "empty" | "error",
        "message": "...",
        "reviews": [...],
        "count": int,
        "intercepted": bool,
    }
    """
    logger.info(f"[Reviews] curl_cffi 抓取商品页原始评论, SKU: {sku}")

    result: Dict[str, Any] = {
        "status": "error",
        "message": "未知错误",
        "reviews": [],
        "count": 0,
        "intercepted": False,
    }

    product_url = f"https://www.noon.com/uae-en/{sku}/p/"
    try:
        async with cffi_requests.AsyncSession(impersonate="firefox") as s:
            r = await s.get(product_url, timeout=30, allow_redirects=True)

        if r.status_code != 200 or len(r.text) < 1000:
            result["status"] = "intercepted"
            result["message"] = f"商品页抓取失败 (HTTP {r.status_code})，可能被 Akamai 拦截。"
            result["intercepted"] = True
            logger.warning(f"[Reviews] {result['message']}")
            return result

        html = r.text
        soup = BeautifulSoup(html, "lxml")

        reviews_raw: List[Dict[str, Any]] = []
        aggregate_rating: Dict[str, Any] | None = None
        product_name: str | None = None
        for script in soup.find_all("script", {"type": "application/ld+json"}):
            text = script.get_text()
            if not text:
                continue
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                continue
            cands = data if isinstance(data, list) else [data]
            if isinstance(data, dict) and "@graph" in data:
                g = data["@graph"]
                cands = g if isinstance(g, list) else [g]
            for e in cands:
                if isinstance(e, dict) and e.get("@type") == "Product":
                    revs = e.get("review", [])
                    if isinstance(revs, list):
                        reviews_raw.extend(revs)
                    elif isinstance(revs, dict):
                        reviews_raw.append(revs)
                    ag = e.get("aggregateRating")
                    if isinstance(ag, dict):
                        aggregate_rating = ag
                    if e.get("name"):
                        product_name = e["name"]

        # 扁平化 JSON-LD review 字段到 _normalize_review 期望的格式
        reviews: List[Dict[str, Any]] = []
        for rev in reviews_raw:
            if not isinstance(rev, dict):
                continue
            rating_info = rev.get("reviewRating") or {}
            author_info = rev.get("author") or {}
            flat = {
                "rating": rating_info.get("ratingValue") if isinstance(rating_info, dict) else rev.get("ratingValue"),
                "title": rev.get("name", ""),
                "body": rev.get("reviewBody") or rev.get("body") or rev.get("description") or "",
                "created_at": rev.get("datePublished") or rev.get("dateCreated"),
                "author": author_info.get("name") if isinstance(author_info, dict) else rev.get("author"),
            }
            reviews.append(_normalize_review(flat))

        if limit and limit > 0:
            reviews = reviews[:limit]

        if not reviews:
            result["status"] = "empty"
            # 区分两种情况：商品有 aggregateRating（有评分但 SSR 未内联评论）vs 完全无评分
            if aggregate_rating:
                rv = aggregate_rating.get("ratingValue")
                rc = aggregate_rating.get("reviewCount") or aggregate_rating.get("ratingCount")
                rating_part = f"评分 {rv}" if rv is not None else ""
                count_part = f"（{rc} 条评价）" if rc else ""
                result["message"] = (
                    f"该商品{rating_part}{count_part}暂无可展示的评论正文（NOON 未在页面内联评论数据，"
                    f"完整评论受 Akamai 防护限制）。"
                )
            else:
                result["message"] = (
                    "该商品暂无评论与评分数据（NOON 页面未提供评论或评分信息）。"
                )
            # 附带 aggregateRating 供前端展示评分概览
            if aggregate_rating:
                result["aggregate_rating"] = {
                    "ratingValue": aggregate_rating.get("ratingValue"),
                    "reviewCount": aggregate_rating.get("reviewCount") or aggregate_rating.get("ratingCount"),
                    "bestRating": aggregate_rating.get("bestRating"),
                }
            if product_name:
                result["product_name"] = product_name
            logger.info(f"[Reviews] 无评论数据, aggregateRating={'有' if aggregate_rating else '无'}")
            return result

        result["status"] = "success"
        result["message"] = f"成功提取 {len(reviews)} 条评论。"
        result["reviews"] = reviews
        result["count"] = len(reviews)
        logger.info(f"[Reviews] 提取到 {len(reviews)} 条评论")

    except Exception as e:
        result["message"] = f"抓取异常: {str(e)}"
        logger.error(f"[Reviews] {result['message']}")

    return result


async def fetch_product_reviews(sku: str, limit: int = 50) -> Dict[str, Any]:
    """用 curl_cffi firefox 指纹抓商品页，从 JSON-LD 提取评论并深度分析。

    noon 评论 API (_svc/reviews-api) 受 Akamai 强防护（需 _abck cookie，JS 生成），
    Playwright 无头被 508、curl_cffi 直调被 508、ScraperAPI 套餐不支持 premium。
    改为从商品页 SSR 的 JSON-LD review 数组提取（含 Top 评论，通常 3-5 条）。

    返回结构：
    {
        "status": "success" | "intercepted" | "empty" | "error",
        "message": "...",
        "reviews": [...],
        "analysis": {...},
        "count": int,
        "intercepted": bool,
    }
    """
    result = await _fetch_raw_reviews(sku, limit=limit)
    if result["status"] != "success" or not result["reviews"]:
        result["analysis"] = analyze_reviews([])
        return result

    result["analysis"] = analyze_reviews(result["reviews"])

    try:
        _translate_reviews(result["reviews"])
        _translate_analysis(result["analysis"])
    except Exception as e:
        logger.error(f"[Reviews] Translation failed: {e}")

    return result
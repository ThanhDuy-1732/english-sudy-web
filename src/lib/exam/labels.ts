// Vietnamese names for question types (exam engine) and mistake categories that use them.
const QUESTION_TYPE_LABELS: Record<string, string> = {
  photo_description: "Mô tả ảnh",
  question_response: "Hỏi – đáp",
  conversation: "Hội thoại",
  short_talk: "Bài nói ngắn",
  incomplete_sentence: "Điền từ vào câu",
  text_completion: "Điền vào đoạn văn",
  single_passage: "Đọc hiểu một đoạn",
  multiple_passage: "Đọc hiểu nhiều đoạn",
  mcq: "Trắc nghiệm",
  true_false_ng: "True / False / Not Given",
  yes_no_ng: "Yes / No / Not Given",
  matching_headings: "Chọn tiêu đề đoạn",
  matching_information: "Nối thông tin",
  sentence_completion: "Điền câu",
  summary_completion: "Điền ghi chú",
  form_completion: "Điền form",
  map_labelling: "Ghi chú bản đồ",
};

/** Readable name for a question type or category id; unknown ids lose their underscores. */
export function questionTypeLabel(id: string): string {
  return QUESTION_TYPE_LABELS[id] ?? id.replace(/_/g, " ");
}

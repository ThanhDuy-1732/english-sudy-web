export interface Anchor {
  band: number;
  text: string;
  why: string;
}

export const SPEAKING_P2_ANCHORS: Anchor[] = [
  {
    band: 6,
    text: `I want to talk about my hometown, which is a medium-sized city. There are many things I like about it. The food is very good and people are friendly. Um, the transport is okay but sometimes it get crowded. I go there every year to visit my family and I always enjoy the experience. The weather is nice most of the time and there are some interesting places to visit, like a market and a park near my house.`,
    why: "Ideas are present but underdeveloped; some grammatical errors (it get, articles missing); range of vocabulary is adequate but limited; some hesitation and repetition.",
  },
  {
    band: 8,
    text: `I'd like to describe a place that holds a special place in my heart — the old quarter of Hanoi, which I had the privilege of exploring during a solo trip two years ago. What struck me immediately was the architectural contrast between the French colonial buildings and the narrow, winding streets lined with ancient merchant houses. The sheer density of life packed into every alleyway — the street vendors, the motorbikes weaving between pedestrians, the aroma of pho drifting from tiny kitchens — created an atmosphere that was simultaneously chaotic and deeply captivating. I spent an entire afternoon simply wandering without a map, which turned out to be the best decision of the trip.`,
    why: "Fluent and coherent delivery; wide lexical range used naturally; complex sentences with subordinate clauses; minimal errors; vivid and well-organised response.",
  },
];

export const WRITING_T2_ANCHORS: Anchor[] = [
  {
    band: 6,
    text: `Nowadays, many people think that technology has changed the way we communicate with each other. In my opinion, I agree that technology has both advantages and disadvantages on communication.\n\nFirstly, technology makes communication faster and more convenient. For example, we can send messages or emails to people anywhere in the world in just a few seconds. This is very helpful for business and keeping in touch with family and friends.\n\nHowever, some people think that technology has made communication less personal. When we use social media or text messages, we cannot see the other person's face or hear their voice, which can lead to misunderstanding.\n\nIn conclusion, while technology has made communication more efficient, it also has some negative effects. I believe we should use technology in a balanced way to maintain good relationships.`,
    why: "Task is addressed but arguments are underdeveloped; paragraphing is present but transitions are mechanical (Firstly, However); vocabulary is adequate but lacks precision; some grammatical errors and repetition.",
  },
  {
    band: 8,
    text: `The rapid proliferation of digital communication tools has fundamentally reshaped interpersonal relationships, prompting debate about whether this transformation is ultimately beneficial. While I acknowledge that technology has democratised communication, enabling connections across vast distances at negligible cost, I contend that the erosion of face-to-face interaction represents a significant societal cost that warrants serious attention.\n\nProponents of digital communication rightly highlight its unparalleled convenience. Platforms such as video conferencing tools have proven indispensable for maintaining professional and personal relationships across geographical boundaries — a fact underscored dramatically during the COVID-19 pandemic, when physical meetings were impossible. Moreover, asynchronous communication formats allow individuals to compose thoughtful responses without the pressure of immediate reply, potentially improving the quality of exchanges.\n\nNevertheless, these advantages do not come without drawbacks. Research in psychology consistently demonstrates that non-verbal cues — facial expressions, posture, tone of voice — convey roughly seventy percent of meaning in human communication. Text-based and even video-based interactions inevitably strip away much of this richness, increasing the likelihood of misinterpretation. Furthermore, the addictive design of social media platforms cultivates superficial engagement over meaningful dialogue, arguably leaving many users feeling more isolated despite being perpetually "connected".\n\nIn conclusion, while digital tools offer genuine communicative efficiencies, their wholesale displacement of in-person interaction risks impoverishing the quality of human connection. A deliberate balance — leveraging technology for its strengths while preserving spaces for direct engagement — seems the most prudent course.`,
    why: "Fully developed argument with clear position; sophisticated vocabulary used accurately; complex sentence structures with minimal errors; effective cohesive devices; well-structured paragraphs with specific examples.",
  },
];

export function buildSpeakingAnchorBlock(): string {
  return SPEAKING_P2_ANCHORS.map(
    (a) => `[BAND ${a.band}] ${a.text}\nReason: ${a.why}`
  ).join("\n\n");
}

export function buildWritingAnchorBlock(): string {
  return WRITING_T2_ANCHORS.map(
    (a) => `[BAND ${a.band}]\n${a.text}\nReason: ${a.why}`
  ).join("\n\n");
}

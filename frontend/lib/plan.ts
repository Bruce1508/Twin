export type PlanDay = {
  day: number;
  week: number;
  theme: string;
  skills: {
    vocab?: string;
    grammar?: string;
    listening?: string;
    reading?: string;
    speaking?: string;
    writing?: string;
  };
  isReview: boolean;
};

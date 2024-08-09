import {extractDecisionNumber} from "@/lib/utils/decision";

describe('extractDecisionNumber', () => {
  test('should extract the decision number correctly', () => {
    const input = 'Arrêt n°21-19.342';
    const expectedOutput = 'n°21-19.342';
    expect(extractDecisionNumber(input)).toBe(expectedOutput);
  });

  test('should extract and clean the decision number correctly', () => {
    const input = 'Arrêt n° 21-19.342, Cour de cassation';
    const expectedOutput = 'n°21-19.342';
    expect(extractDecisionNumber(input)).toBe(expectedOutput);
  });

  test('should handle extra spaces and commas in the input', () => {
    const input = 'Arrêt n°    21-19.342  ,   Cour de cassation';
    const expectedOutput = 'n°21-19.342';
    expect(extractDecisionNumber(input)).toBe(expectedOutput);
  });

  test('should throw an error if the decision number is not found', () => {
    const input = 'Arrêt Cour de cassation';
    expect(() => extractDecisionNumber(input)).toThrow("Decision number not found in the string");
  });

  test('should throw an error if "n°" or "Cour" is missing', () => {
    const input = 'Arrêt 21-19.342 de cassation';
    expect(() => extractDecisionNumber(input)).toThrow("Decision number not found in the string");
  });

  test('should handle prefix before number', () => {
    const input = "Arrêt n° RG 19/20729";
    const expectedOutput = 'n°19/20729';
    expect(extractDecisionNumber(input)).toBe(expectedOutput);
  })
});

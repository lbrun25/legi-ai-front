import {extractArticleNumber, extractArticleSource} from "../article";

describe('extractArticleSource', () => {
  test('should handle input with only the word "Code"', () => {
    const input = 'Code';
    expect(() => extractArticleSource(input)).toThrow("Article source not found in the string");
  });

  test('should throw an error when "Code" is not present', () => {
    const input = 'Example 1234 with symbols &*!';
    expect(() => extractArticleSource(input)).toThrow("Article source not found in the string");
  });

  test('should remove non-letter characters and format the rest correctly', () => {
    const input = 'Article 112 Code De La Consommation';
    const expectedOutput = 'Code de la consommation';
    expect(extractArticleSource(input)).toBe(expectedOutput);
  });

  test('should handle accents', () => {
    const input = 'Article 56 Code de procédure civile';
    const expectedOutput = 'Code de procédure civile';
    expect(extractArticleSource(input)).toBe(expectedOutput);
  })
});

describe('extractArticleNumber', () => {
  test('should extract and format the article number correctly', () => {
    const input = 'Article 1234 Code Example';
    const expectedOutput = '1234';
    expect(extractArticleNumber(input)).toBe(expectedOutput);
  });

  test('should remove spaces within the article number', () => {
    const input = 'Article 12 34 56 Code Example';
    const expectedOutput = '123456';
    expect(extractArticleNumber(input)).toBe(expectedOutput);
  });

  test('should remove periods within the article number', () => {
    const input = 'Article 12.34.56 Code Example';
    const expectedOutput = '123456';
    expect(extractArticleNumber(input)).toBe(expectedOutput);
  });

  test('should throw an error if "Article" is not followed by a number', () => {
    const input = 'Article Code Example';
    expect(() => extractArticleNumber(input)).toThrow("Article number not found in the string");
  });

  test('should throw an error if "Code" is not present', () => {
    const input = 'Article 1234 Example';
    expect(() => extractArticleNumber(input)).toThrow("Article number not found in the string");
  });

  test('should handle leading and trailing spaces around the article number', () => {
    const input = 'Article   1234   Code Example';
    const expectedOutput = '1234';
    expect(extractArticleNumber(input)).toBe(expectedOutput);
  });

  test('should handle cases with multiple spaces between words', () => {
    const input = 'Article   12  34   56   Code Example';
    const expectedOutput = '123456';
    expect(extractArticleNumber(input)).toBe(expectedOutput);
  });

  test('should handle special characters within the article number', () => {
    const input = 'Article 12.34.56 Code Example';
    const expectedOutput = '123456';
    expect(extractArticleNumber(input)).toBe(expectedOutput);
  });
});

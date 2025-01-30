import { SeniorityValueResponse } from "@/lib/types/bp";
import {calculateLegalSeverancePay} from "@/lib/utils/bp";
import {describe, expect, test} from '@jest/globals';

describe('calculateLegalSeverancePay', () => {
  test('should calculate indemnity for seniority less than 10 years', () => {
    const salary = 2000;
    const seniority: SeniorityValueResponse = {
      total_years: 8,
      total_months: 6,
      formatted_duration: "8 years and 6 months",
    };
    const result = calculateLegalSeverancePay(salary, seniority);
    expect(result).toBe(4250); // (2000 * 1/4 * 8) + (2000 * 1/4 * (6/12))
  });

  test('should calculate indemnity for seniority more than 10 years', () => {
    const salary = 2000;
    const seniority: SeniorityValueResponse = {
      total_years: 12,
      total_months: 0,
      formatted_duration: "12 years",
    };
    const result = calculateLegalSeverancePay(salary, seniority);
    expect(result).toBe(6333.33); // (2000 * 1/4 * 10) + (2000 * 1/3 * 2)
  });

  test('should calculate indemnity for seniority with incomplete months', () => {
    const salary = 2000;
    const seniority: SeniorityValueResponse = {
      total_years: 10,
      total_months: 6,
      formatted_duration: "10 years and 6 months",
    };
    const result = calculateLegalSeverancePay(salary, seniority);
    expect(result).toBe(5416.67); // (2000 * 1/4 * 10) + (2000 * 1/4 * (6/12))
  });

  test('should calculate indemnity for seniority exactly 10 years', () => {
    const salary = 3000;
    const seniority: SeniorityValueResponse = {
      total_years: 10,
      total_months: 0,
      formatted_duration: "10 years",
    };
    const result = calculateLegalSeverancePay(salary, seniority);
    expect(result).toBe(7500); // (3000 * 1/4 * 10)
  });

  test('should return 0 for no seniority', () => {
    const salary = 2000;
    const seniority: SeniorityValueResponse = {
      total_years: 0,
      total_months: 0,
      formatted_duration: "0 years",
    };
    const result = calculateLegalSeverancePay(salary, seniority);
    expect(result).toBe(0);
  });
});

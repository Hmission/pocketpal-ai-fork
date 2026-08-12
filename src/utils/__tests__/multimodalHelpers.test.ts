import {
  isVisionRepo,
  getMmprojFiles,
  isProjectionModel,
  getRecommendedProjectionModel,
  getLLMFiles,
} from '../multimodalHelpers';
import {ModelFile} from '../types';

describe('multimodalHelpers', () => {
  // Test data for model files
  const testModelFiles: ModelFile[] = [
    {
      rfilename: 'llama-3.1-8b-instruct-q4_0.gguf',
      size: 4000000000,
    },
    {
      rfilename: 'llama-3.1-8b-instruct-q5_k_m.gguf',
      size: 5000000000,
    },
    {
      rfilename: 'mmproj-llama-3.1-vision-q4_0.gguf',
      size: 100000000,
    },
    {
      rfilename: 'mmproj_llama-3.1-vision-q5_k_m.gguf',
      size: 120000000,
    },
    {
      rfilename: 'mmproj.llama-3.1-vision-q8_0.gguf',
      size: 150000000,
    },
  ];
  const testModelFilesWithDot: ModelFile[] = [
    {
      rfilename: 'llama-3.1-8b-instruct-q4_0.gguf',
      size: 4000000000,
    },
    {
      rfilename: 'mmproj.llama-3.1-vision-q8_0.gguf',
      size: 150000000,
    },
  ];

  const testModelFilesWithDash: ModelFile[] = [
    {
      rfilename: 'llama-3.1-8b-instruct-q4_0.gguf',
      size: 4000000000,
    },
    {
      rfilename: 'mmproj-llama-3.1-vision-q8_0.gguf',
      size: 150000000,
    },
  ];

  const testModelFilesWith_: ModelFile[] = [
    {
      rfilename: 'llama-3.1-8b-instruct-q4_0.gguf',
      size: 4000000000,
    },
    {
      rfilename: 'mmproj_llama-3.1-vision-q8_0.gguf',
      size: 150000000,
    },
  ];

  const nonVisionFiles: ModelFile[] = [
    {
      rfilename: 'llama-3.1-8b-instruct-q4_0.gguf',
      size: 4000000000,
    },
    {
      rfilename: 'mmprojblabblah-instruct-q5_k_m.gguf',
      size: 5000000000,
    },
  ];

  // Test isVisionRepo function
  describe('isVisionRepo', () => {
    it('returns true when repository contains mmproj files', () => {
      expect(isVisionRepo(testModelFiles)).toBe(true);
    });

    it('returns true when repository does contain mmproj files only .', () => {
      expect(isVisionRepo(testModelFilesWithDot)).toBe(true);
    });

    it('returns true when repository does contain mmproj files only -', () => {
      expect(isVisionRepo(testModelFilesWithDash)).toBe(true);
    });

    it('returns true when repository does contain mmproj files only _', () => {
      expect(isVisionRepo(testModelFilesWith_)).toBe(true);
    });

    it('returns false when repository does not contain mmproj files', () => {
      expect(isVisionRepo(nonVisionFiles)).toBe(false);
    });

    it('returns false for empty array', () => {
      expect(isVisionRepo([])).toBe(false);
    });
  });

  // Test getMmprojFiles function
  describe('getMmprojFiles', () => {
    it('returns only mmproj files from repository', () => {
      const result = getMmprojFiles(testModelFiles);
      expect(result.length).toBe(3);
      expect(result.every(file => file.rfilename.startsWith('mmproj'))).toBe(
        true,
      );
    });

    it('returns empty array when no mmproj files exist', () => {
      expect(getMmprojFiles(nonVisionFiles).length).toBe(0);
    });

    it('returns empty array for empty input', () => {
      expect(getMmprojFiles([])).toEqual([]);
    });
  });

  // Test isProjectionModel function
  describe('isProjectionModel', () => {
    it('returns true for projection model filenames', () => {
      expect(isProjectionModel('mmproj.llama-3.1-vision-q4_0.gguf')).toBe(true);
      expect(isProjectionModel('mmproj-llama-3.1-vision-q4_0.gguf')).toBe(true);
      expect(isProjectionModel('mmproj_llama-3.1-vision-q5_k_m.gguf')).toBe(
        true,
      );
    });

    it('returns false for non-projection model filenames', () => {
      expect(isProjectionModel('llama-3.1-8b-instruct-q4_0.gguf')).toBe(false);
      expect(isProjectionModel('vision-model-q8_0.gguf')).toBe(false);
    });

    it('handles case insensitivity', () => {
      expect(isProjectionModel('MMpROJ-llama-3.1-vision-q4_0.gguf')).toBe(true);
    });
  });

  // Test getLLMFiles function
  describe('getLLMFiles', () => {
    it('returns only LLM files from repository', () => {
      const result = getLLMFiles(testModelFiles);
      expect(result.length).toBe(2);
      expect(result.every(file => !file.rfilename.startsWith('mmproj'))).toBe(
        true,
      );
    });

    it('returns all files when no mmproj files exist', () => {
      expect(getLLMFiles(nonVisionFiles).length).toBe(2);
    });

    it('returns empty array when only mmproj files exist', () => {
      const onlyVisionFiles: ModelFile[] = [
        {
          rfilename: 'mmproj-llama-3.1-vision-q4_0.gguf',
          size: 100000000,
        },
      ];
      expect(getLLMFiles(onlyVisionFiles).length).toBe(0);
    });

    it('returns empty array for empty input', () => {
      expect(getLLMFiles([])).toEqual([]);
    });
  });

  describe('getRecommendedProjectionModel', () => {
    // Test case 1: Empty array of projection models
    it('returns undefined when no projection models are available', () => {
      const result = getRecommendedProjectionModel(
        'llama-3.1-8b-instruct-q4_0.gguf',
        [],
      );
      expect(result).toBeUndefined();
    });

    // Test case 2: Only one projection model available
    it('returns the only available projection model when only one exists', () => {
      const result = getRecommendedProjectionModel(
        'llama-3.1-8b-instruct-q4_0.gguf',
        ['mmproj-llama-3.1-vision-q5_k_m.gguf'],
      );
      expect(result).toBe('mmproj-llama-3.1-vision-q5_k_m.gguf');
    });

    // Test case 3: Exact quantization match
    it('returns the projection model with exact quantization match', () => {
      const result = getRecommendedProjectionModel(
        'llama-3.1-8b-instruct-q4_0.gguf',
        [
          'mmproj-llama-3.1-vision-q5_k_m.gguf',
          'mmproj-llama-3.1-vision-q4_0.gguf',
          'mmproj-llama-3.1-vision-q8_0.gguf',
        ],
      );
      expect(result).toBe('mmproj-llama-3.1-vision-q4_0.gguf');
    });

    // Test case 4: Higher quality quantization when exact match not found
    it('returns a higher quality projection model when exact match not found', () => {
      const result = getRecommendedProjectionModel(
        'llama-3.1-8b-instruct-q4_0.gguf',
        [
          'mmproj-llama-3.1-vision-q5_k_m.gguf',
          'mmproj-llama-3.1-vision-q8_0.gguf',
        ],
      );
      expect(result).toBe('mmproj-llama-3.1-vision-q5_k_m.gguf');
    });

    // Test case 5: First available when no match or higher quality found
    it('returns the first available projection model when no match or higher quality found', () => {
      const result = getRecommendedProjectionModel(
        'llama-3.1-8b-instruct-q6_k.gguf',
        [
          'mmproj-llama-3.1-vision-q4_0.gguf',
          'mmproj-llama-3.1-vision-q5_k_m.gguf',
        ],
      );
      // this fails since q5 is the highest quality that should have been returned in cases of no match or higher quality found but Received: "mmproj-llama-3.1-vision-q4_0.gguf"
      expect(result).toBe('mmproj-llama-3.1-vision-q5_k_m.gguf');
    });

    // Test case 6: Case insensitivity
    it('handles case insensitivity in quantization levels', () => {
      const result = getRecommendedProjectionModel(
        'llama-3.1-8b-instruct-q4_0.gguf',
        [
          'mmproj-llama-3.1-vision-q5_k_m.gguf',
          'mmproj-llama-3.1-vision-Q4.gguf',
          'mmproj-llama-3.1-vision-q8_0.gguf',
        ],
      );
      expect(result).toBe('mmproj-llama-3.1-vision-Q4.gguf');
    });

    // Test case 7: Different quantization formats
    it('handles different quantization formats correctly', () => {
      const result = getRecommendedProjectionModel(
        'llama-3.1-8b-instruct-q4.gguf', // Using dot instead of underscore
        [
          'mmproj-llama-3.1-vision-q4_0.gguf',
          'mmproj-llama-3.1-vision-q5_k_m.gguf',
        ],
      );
      expect(result).toBe('mmproj-llama-3.1-vision-q4_0.gguf');
    });

    // Test case 8: No quantization in LLM filename
    it('returns first available when LLM has no quantization in filename', () => {
      const result = getRecommendedProjectionModel(
        'llama-3.1-8b-instruct.gguf', // No quantization
        [
          'mmproj-llama-3.1-vision-q4_0.gguf',
          'mmproj-llama-3.1-vision-q5_k_m.gguf',
          'mmproj-llama-3.1-vision-q8_0.gguf',
        ],
      );
      // this fails since q8 is the highest quality but Received: "mmproj-llama-3.1-vision-q4_0.gguf"
      expect(result).toBe('mmproj-llama-3.1-vision-q8_0.gguf');
    });

    // Test case 9: Different quantization prefixes (iq vs q)
    it('handles different quantization prefixes correctly', () => {
      const result = getRecommendedProjectionModel(
        'llama-3.1-8b-instruct-iq4_xs.gguf', // Using iq prefix
        [
          'mmproj-llama-3.1-vision-q3_0.gguf',
          'mmproj-llama-3.1-vision-Q4.gguf',
          'mmproj-llama-3.1-vision-q8_0.gguf',
        ],
      );
      expect(result).toBe('mmproj-llama-3.1-vision-Q4.gguf');
    });

    // Test case 10: Edge case with unusual quantization format
    it('handles edge cases with unusual quantization formats', () => {
      const result = getRecommendedProjectionModel(
        'llama-3.1-8b-instruct-Q4-K.gguf', // Using hyphen instead of underscore
        [
          'mmproj-llama-3.1-vision-q4_k.gguf',
          'mmproj-llama-3.1-vision-q5_k_m.gguf',
        ],
      );
      expect(result).toBe('mmproj-llama-3.1-vision-q4_k.gguf');
    });
  });
});

/**
 * RFC 7233 - Hypertext Transfer Protocol (HTTP/1.1): Range Requests
 * Parses the HTTP Range header and returns the start and end byte positions.
 * Supports single range and multiple ranges.
 *
 * Examples
 * * 1. Single range: "bytes=0-499" => [{ start: 0, end: 499 }]
 * * 2. Multiple ranges: "bytes=0-499,500-999" => [{ start: 0, end: 499 }, { start: 500, end: 999 }]
 * * 3. Open-ended range: "bytes=500-" => [{ start: 500, end: fileSize - 1 }]
 * * 4. Suffix range: "bytes=-500" => [{ start: fileSize - 500, end: fileSize - 1 }]
 */
export const parseHttpRangeHeaders = (
  rangeHeader: string,
  fileSize: number,
): Array<{ start: number; end: number }> | null => {
  if (!rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const ranges = rangeHeader
    .substring(6)
    .split(',')
    .map(range => range.trim());
  const result: Array<{ start: number; end: number }> = [];

  for (const range of ranges) {
    const [startStr, endStr] = range.split('-').map(part => part.trim());

    let start: number | null = null;
    let end: number | null = null;

    if (startStr === '') {
      // Suffix range: "-500"
      const suffixLength = parseInt(endStr, 10);
      if (isNaN(suffixLength) || suffixLength <= 0) {
        return null;
      }
      start = Math.max(fileSize - suffixLength, 0);
      end = fileSize - 1;
    } else {
      start = parseInt(startStr, 10);
      if (isNaN(start) || start < 0) {
        return null;
      }

      if (endStr === '') {
        // Open-ended range: "500-"
        end = fileSize - 1;
      } else {
        end = parseInt(endStr, 10);
        if (isNaN(end) || end < start) {
          return null;
        }
      }
    }

    if (start >= fileSize) {
      return null;
    }

    result.push({ start, end: Math.min(end!, fileSize - 1) });
  }

  return result;
};

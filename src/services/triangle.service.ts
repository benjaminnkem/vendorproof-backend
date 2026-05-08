export const calculateTriangleArea = (base: number, height: number): number => {
  if (base <= 0 || height <= 0) {
    throw new Error("Base and height must be positive numbers.");
  }

  return (base * height) / 2;
};

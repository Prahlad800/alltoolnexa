import {
  slugify,
  number,
  positive,
  nonzero,
  integer,
  list,
  sum,
  round,
  gcd,
  date,
  iso,
  DAY,
  csvRows,
  csvCell,
  escapeHTML,
  httpURL,
} from "./core.mjs";

export const tools = [];
const runners = new Map();
export const categories = [
  [
    "math",
    "Math & numbers",
    "∑",
    "Everyday arithmetic, statistics and number theory.",
  ],
  ["student", "Student", "✎", "Marks, attendance and study planning."],
  [
    "office",
    "Office & salary",
    "▤",
    "Work hours, salary and employee calculations.",
  ],
  [
    "finance",
    "Finance & business",
    "↗",
    "Transparent calculations with your own assumptions.",
  ],
  [
    "marketing",
    "Marketing & SaaS",
    "◎",
    "Measure campaigns and understand your business.",
  ],
  [
    "date-time",
    "Date & time",
    "◷",
    "Calendar arithmetic and time conversions.",
  ],
  [
    "converters",
    "Unit converters",
    "⇄",
    "Convert lengths, temperatures, sizes and more.",
  ],
  ["text", "Text & writing", "Aa", "Clean, count, format and transform text."],
  [
    "developer",
    "Developer",
    "</>",
    "Format data, encode strings and inspect URLs.",
  ],
  ["design", "Design & CSS", "◈", "Colors, contrast and CSS you can copy."],
  [
    "image",
    "Image tools",
    "▧",
    "Resize, crop and convert images on your device.",
  ],
  [
    "pdf",
    "PDF tools",
    "▥",
    "Work with PDF documents privately in your browser.",
  ],
  ["qr", "QR & barcodes", "▦", "Create downloadable QR codes and barcodes."],
  ["india", "India utilities", "₹", "Indian numbers and format checks."],
  [
    "home",
    "Home & everyday",
    "⌂",
    "Plan materials, recipes, travel and power costs.",
  ],
  [
    "random",
    "Random & security",
    "⚄",
    "Secure randomness, passwords and hashes.",
  ],
  ["seo", "SEO & social", "⌕", "Metadata, social links and content helpers."],
  [
    "templates",
    "Documents & templates",
    "☷",
    "Editable, rule-based drafts from your details.",
  ],
].map(([id, name, icon, description]) => ({ id, name, icon, description }));

export const field = (key, label, value = "", type = "number", options) => ({
  key,
  label,
  value,
  type,
  ...(options ? { options } : {}),
});
const f = field;
const a = (label = "First value", value = 100) => f("a", label, value);
const b = (label = "Second value", value = 20) => f("b", label, value);
const c = (label = "Third value", value = 12) => f("c", label, value);
const text = (value = "Hello world") =>
  f("text", "Your text", value, "textarea");
export function register(category, name, fields, formula, run, extra = {}) {
  const id = extra.id || slugify(name);
  if (runners.has(id)) throw Error(`Duplicate tool ${id}`);
  const tool = {
    id,
    name,
    category,
    fields,
    formula,
    description:
      extra.description || `${name} with an instant result. ${formula}`,
    kind: "standard",
    ...extra,
  };
  tools.push(tool);
  runners.set(id, run);
  return tool;
}
export function evaluate(id, input) {
  const run = runners.get(id);
  if (!run) throw Error("This tool is not available.");
  const result = run(input);
  if (typeof result === "number") {
    if (!Number.isFinite(result))
      throw Error("These inputs do not produce a finite result.");
    return round(result);
  }
  return result;
}
export const getTool = (id) => tools.find((t) => t.id === id);
export const defaults = (tool) =>
  Object.fromEntries(tool.fields.map((f) => [f.key, String(f.value)]));
const n = (v, k = "a") => number(v[k]);
const p = (v, k = "a") => positive(v[k]);
const I = (v, k = "a", min = 0, max = 1e9) => integer(v[k], k, min, max);
const percent = (v, k) => number(v[k], k, 0, 100);
const calc = (cat, name, fields, formula, run, extra) =>
  register(cat, name, fields, formula, run, extra);

// Arithmetic and statistics. Each calculation has its own fields and explanation.
calc(
  "math",
  "Percentage Calculator",
  [a("Value", 200), b("Percentage", 15)],
  "Result = value × percentage ÷ 100.",
  (v) => (n(v) * n(v, "b")) / 100,
);
calc(
  "math",
  "Percentage Change",
  [a("Original value", 80), b("New value", 100)],
  "Change = (new − original) ÷ |original| × 100. Original cannot be zero.",
  (v) => ((n(v, "b") - n(v)) / Math.abs(nonzero(v.a))) * 100,
);
calc(
  "math",
  "Percentage Error",
  [a("Measured value", 9.8), b("Accepted value", 10)],
  "Absolute difference divided by the absolute accepted value, multiplied by 100.",
  (v) => (Math.abs(n(v) - n(v, "b")) / Math.abs(nonzero(v.b))) * 100,
);
calc(
  "math",
  "Ratio Simplifier",
  [a("First integer", 24), b("Second integer", 36)],
  "Divide both whole numbers by their greatest common divisor.",
  (v) => {
    const x = I(v),
      y = I(v, "b");
    const g = gcd(x, y);
    if (!g) throw Error("Both numbers cannot be zero.");
    return `${x / g}:${y / g}`;
  },
);
calc(
  "math",
  "Fraction Simplifier",
  [a("Numerator", 12), b("Denominator", 18)],
  "Reduce a fraction to its lowest terms.",
  (v) => {
    let x = integer(v.a, 'Numerator', -Number.MAX_SAFE_INTEGER),
      y = integer(v.b, 'Denominator', -Number.MAX_SAFE_INTEGER);
    if(y===0)throw Error('Denominator cannot be zero.');
    if(y<0){x=-x;y=-y;}
    const g = gcd(x, y);
    return `${x / g}/${y / g}`;
  },
);
calc(
  "math",
  "Fraction to Decimal",
  [a("Numerator", 3), b("Denominator", 4)],
  "Divide the numerator by a nonzero denominator.",
  (v) => n(v) / nonzero(v.b, 'Denominator'),
);
calc(
  "math",
  "Decimal to Fraction",
  [a("Decimal", 0.375)],
  "Convert a finite decimal (up to six decimal places) into a reduced fraction.",
  (v) => {
    const x = n(v);
    if (Math.abs(x) > 1e9) throw Error("Use a number below one billion.");
    const den = 1e6,
      num = Math.round(x * den),
      g = gcd(num, den);
    return `${num / g}/${den / g}`;
  },
);
for (const [name, fn, formula] of [
  [
    "Average Calculator",
    (xs) => sum(xs) / xs.length,
    "Sum of values divided by the number of values.",
  ],
  [
    "Median Calculator",
    (xs) => {
      xs.sort((a, b) => a - b);
      const m = Math.floor(xs.length / 2);
      return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
    },
    "Middle value after sorting; average the middle two for an even count.",
  ],
  [
    "Mode Calculator",
    (xs) => {
      const counts = new Map();
      xs.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
      const max = Math.max(...counts.values());
      return max === 1
        ? "No mode (all values occur once)"
        : Array.from(counts)
            .filter((x) => x[1] === max)
            .map((x) => x[0])
            .join(", ");
    },
    "Return all values with the highest frequency.",
  ],
  [
    "Variance Calculator",
    (xs) => {
      const avg = sum(xs) / xs.length;
      return sum(xs.map((x) => (x - avg) ** 2)) / xs.length;
    },
    "Population variance: sum of squared deviations divided by N.",
  ],
  [
    "Standard Deviation",
    (xs) => {
      const avg = sum(xs) / xs.length;
      return Math.sqrt(sum(xs.map((x) => (x - avg) ** 2)) / xs.length);
    },
    "Population standard deviation: square root of population variance.",
  ],
  [
    "HCF/GCD Calculator",
    (xs) => xs.reduce((g, x) => gcd(g, integer(x))),
    "Greatest common divisor of nonnegative integers.",
  ],
  [
    "LCM Calculator",
    (xs) =>
      xs.reduce((r, x) => {
        x = integer(x);
        const value = r && x ? (r / gcd(r, x)) * x : 0;
        if (!Number.isSafeInteger(value))
          throw Error("Result exceeds safe integer precision.");
        return value;
      }, 1),
    "Least common multiple of nonnegative integers.",
  ],
])
  calc(
    "math",
    name,
    [
      f(
        "text",
        "Numbers separated by spaces or commas",
        "2, 4, 4, 6, 9",
        "textarea",
      ),
    ],
    formula,
    (v) => fn(list(v.text)),
  );
calc(
  "math",
  "Prime Number Checker",
  [a("Whole number", 97)],
  "Test divisibility up to the square root; supports integers up to one billion.",
  (v) => {
    const x = I(v);
    if (x < 2) return "Not prime";
    for (let i = 2; i * i <= x; i++) if (x % i === 0) return "Not prime";
    return "Prime";
  },
);
calc(
  "math",
  "Prime Factorization",
  [a("Integer", 360)],
  "Divide repeatedly by prime factors.",
  (v) => {
    let x = integer(v.a, "Integer", 2, 1e9),
      out = [];
    for (let i = 2; i * i <= x; i++)
      while (x % i === 0) {
        out.push(i);
        x /= i;
      }
    if (x > 1) out.push(x);
    return out.join(" × ");
  },
);
for (const [name, formula, fn] of [
  [
    "Square Root",
    "Nonnegative square root.",
    (v) => Math.sqrt(number(v.a, "Value", 0)),
  ],
  ["Cube Root", "The real cube root, including for negative values.", (v) => Math.cbrt(n(v))],
  [
    "Factorial Calculator",
    "Product of integers from 1 to N (N ≤ 170).",
    (v) => {
      const x = integer(v.a, "N", 0, 170);
      let r = 1;
      for (let i = 2; i <= x; i++) r *= i;
      return r;
    },
  ],
])
  calc("math", name, [a("Value", 9)], formula, fn);
calc(
  "math",
  "Power Calculator",
  [a("Base", 2), b("Exponent", 10)],
  "Raise the base to the given exponent.",
  (v) => n(v) ** n(v, "b"),
);
for (const comb of [false, true])
  calc(
    "math",
    comb ? "Combination Calculator" : "Permutation Calculator",
    [a("Total items (n)", 10), b("Selected items (r)", 3)],
    comb
      ? "n choose r: unordered selections without replacement."
      : "nPr: ordered selections without replacement.",
    (v) => {
      const x = I(v, "a", 0, 170),
        y = I(v, "b", 0, x);
      let r = 1;
      for (let i = 0; i < y; i++) r *= comb ? (x - i) / (i + 1) : x - i;
      return Math.round(r);
    },
  );
calc(
  "math",
  "Probability Calculator",
  [a("Favorable outcomes", 3), b("Total outcomes", 10)],
  "Probability = favorable outcomes ÷ total outcomes.",
  (v) => {
    const x = number(v.a, "Favorable outcomes", 0),
      y = p(v, "b");
    if (x > y) throw Error("Favorable outcomes cannot exceed total outcomes.");
    return `${round((x / y) * 100)}%`;
  },
);
calc(
  "math",
  "Quadratic Equation Solver",
  [a("a", 1), b("b", -3), c("c", 2)],
  "Solve ax² + bx + c = 0 using the quadratic formula.",
  (v) => {
    const x = n(v),
      y = n(v, "b"),
      z = n(v, "c");
    if (!x) throw Error("a must be nonzero.");
    const d = y * y - 4 * x * z;
    if (d < 0)
      return `Complex roots: ${round(-y / (2 * x))} ± ${round(Math.sqrt(-d) / Math.abs(2 * x))}i`;
    return `x₁ = ${round((-y + Math.sqrt(d)) / (2 * x))}, x₂ = ${round((-y - Math.sqrt(d)) / (2 * x))}`;
  },
);
calc(
  "math",
  "Number Sequence Generator",
  [a("Start", 1), b("Step", 2), c("Count", 10)],
  "Arithmetic progression: start + index × step.",
  (v) =>
    Array.from({ length: integer(v.c, "Count", 1, 1000) }, (_, i) =>
      round(n(v) + i * n(v, "b")),
    ).join(", "),
);
const romans = [
  ["M", 1000],
  ["CM", 900],
  ["D", 500],
  ["CD", 400],
  ["C", 100],
  ["XC", 90],
  ["L", 50],
  ["XL", 40],
  ["X", 10],
  ["IX", 9],
  ["V", 5],
  ["IV", 4],
  ["I", 1],
];
calc(
  "math",
  "Roman Numeral Converter",
  [a("Integer (1–3999)", 2026)],
  "Convert a positive integer into standard Roman numerals.",
  (v) => {
    let x = integer(v.a, "Number", 1, 3999),
      s = "";
    for (const [r, n] of romans)
      while (x >= n) {
        s += r;
        x -= n;
      }
    return s;
  },
);
const geometries = [
  ["Circle Area", [a("Radius", 5)], "π × radius²", (v) => Math.PI * p(v) ** 2],
  [
    "Circle Circumference",
    [a("Radius", 5)],
    "2 × π × radius",
    (v) => 2 * Math.PI * p(v),
  ],
  [
    "Rectangle Area",
    [a("Length", 8), b("Width", 5)],
    "length × width",
    (v) => p(v) * p(v, "b"),
  ],
  ["Square Area", [a("Side", 5)], "side²", (v) => p(v) ** 2],
  [
    "Triangle Area",
    [a("Base", 8), b("Height", 5)],
    "base × perpendicular height ÷ 2",
    (v) => (p(v) * p(v, "b")) / 2,
  ],
  [
    "Triangle Perimeter",
    [a("Side a", 3), b("Side b", 4), c("Side c", 5)],
    "Sum of three sides; the triangle inequality must hold.",
    (v) => {
      const sides = [p(v), p(v, "b"), p(v, "c")].sort((a, b) => a - b);
      if (sides[0] + sides[1] <= sides[2])
        throw Error("These sides cannot form a triangle.");
      return sum(sides);
    },
  ],
  [
    "Pythagorean Calculator",
    [a("Leg a", 3), b("Leg b", 4)],
    "hypotenuse = √(a² + b²)",
    (v) => Math.hypot(p(v), p(v, "b")),
  ],
  [
    "Trapezoid Area",
    [a("Parallel side a", 8), b("Parallel side b", 6), c("Height", 5)],
    "(a + b) × height ÷ 2",
    (v) => ((p(v) + p(v, "b")) * p(v, "c")) / 2,
  ],
  [
    "Cylinder Volume",
    [a("Radius", 3), b("Height", 10)],
    "π × radius² × height",
    (v) => Math.PI * p(v) ** 2 * p(v, "b"),
  ],
  ["Cube Volume", [a("Side", 5)], "side³", (v) => p(v) ** 3],
  [
    "Sphere Volume",
    [a("Radius", 5)],
    "4/3 × π × radius³",
    (v) => (4 / 3) * Math.PI * p(v) ** 3,
  ],
  [
    "Cone Volume",
    [a("Radius", 3), b("Height", 10)],
    "π × radius² × height ÷ 3",
    (v) => (Math.PI * p(v) ** 2 * p(v, "b")) / 3,
  ],
  [
    "Slope Calculator",
    [a("x₁", 1), b("y₁", 2), c("x₂", 4), f("d", "y₂", 8)],
    "(y₂ − y₁) ÷ (x₂ − x₁)",
    (v) => {
      const dx = n(v, "c") - n(v);
      if (!dx) return "Undefined (vertical line)";
      return (n(v, "d") - n(v, "b")) / dx;
    },
  ],
];
for (const [name, fields, formula, run] of geometries)
  calc("math", name, fields, `Use consistent units. Formula: ${formula}.`, run);

// Students and workplace calculations.
calc(
  "student",
  "Marks Percentage Calculator",
  [a("Marks obtained", 420), b("Maximum marks", 500)],
  "Marks obtained ÷ maximum marks × 100.",
  (v) => {
    const x = number(v.a, "Marks", 0),
      y = p(v, "b");
    if (x > y) throw Error("Marks cannot exceed the maximum.");
    return `${round((x / y) * 100)}%`;
  },
);
calc(
  "student",
  "CGPA to Percentage",
  [{...a("CGPA", 8.5),min:0}, b("Institution multiplier", 9.5), {...f("scale","Maximum CGPA scale",10),min:1,max:100}],
  "CGPA × your institution’s multiplier. Institutions use different conversion rules.",
  (v) => {const scale=number(v.scale??10,"Maximum CGPA scale",1,100);const result=number(v.a,"CGPA",0,scale)*p(v,"b");if(result>100)throw Error("Converted percentage exceeds 100. Check your grading scale and institution multiplier.");return result;},
);
calc(
  "student",
  "Required Attendance Calculator",
  [
    a("Classes attended", 60),
    b("Classes held", 90),
    c("Target percentage", 75),
  ],
  "Minimum future classes to attend without absence: ceiling((target × held − attended) ÷ (1 − target)).",
  (v) => {
    const attended = I(v),
      held = I(v, "b", attended),
      target = number(v.c, "Target", 0, 100) / 100;
    if (target === 1)
      return attended === held ? 0 : "100% is impossible after an absence.";
    return Math.max(
      0,
      Math.ceil((target * held - attended) / (1 - target) - 1e-10),
    );
  },
);
calc(
  "student",
  "Bunk Calculator",
  [
    a("Classes attended", 80),
    b("Classes held", 100),
    c("Minimum attendance (%)", 75),
  ],
  "Maximum additional absences: floor(attended ÷ required fraction − held).",
  (v) => {
    const attended = I(v),
      held = I(v, "b", attended),
      t = number(v.c, "Minimum attendance", 0.01, 100) / 100;
    return Math.max(0, Math.floor(attended / t - held + 1e-10));
  },
);
calc(
  "student",
  "Attendance Calculator",
  [a("Attended classes", 75), b("Total classes", 100)],
  "Attended ÷ total × 100.",
  (v) => {
    const x = I(v),
      y = I(v, "b", 1);
    if (x > y) throw Error("Attended cannot exceed total.");
    return `${round((x / y) * 100)}%`;
  },
);
calc(
  "student",
  "Weighted Marks Calculator",
  [
    f("text", "Marks (one per line)", "80\n90\n70", "textarea"),
    f("weights", "Matching weights or credits", "3\n4\n3", "textarea"),
  ],
  "Weighted average = sum(mark × weight) ÷ sum(weights).",
  (v) => {
    const xs = list(v.text),
      ws = list(v.weights);
    if (xs.length !== ws.length || ws.some((w) => w < 0) || sum(ws) <= 0)
      throw Error(
        "Provide one nonnegative weight per mark and a positive total.",
      );
    return sum(xs.map((x, i) => x * ws[i])) / sum(ws);
  },
);
calc(
  "student",
  "Correct/Wrong Answer Score Calculator",
  [
    a("Correct answers", 40),
    b("Wrong answers", 10),
    c("Marks per correct answer", 4),
    f("d", "Penalty per wrong answer", 1),
  ],
  "Score = correct × marks − wrong × penalty. Enter the marking scheme yourself.",
  (v) => I(v) * number(v.c, "Marks", 0) - I(v, "b") * number(v.d, "Penalty", 0),
);
calc(
  "student",
  "Passing Marks Calculator",
  [a("Maximum marks", 100), b("Passing percentage", 33)],
  "Minimum whole marks = ceiling(maximum × passing percentage ÷ 100).",
  (v) => Math.ceil((p(v) * percent(v, "b")) / 100),
);
calc(
  "student",
  "Target CGPA Calculator",
  [
    a("Current CGPA", 7.5),
    b("Completed credits", 60),
    c("Target CGPA", 8),
    f("d", "Remaining credits", 40),
  ],
  "Required remaining GPA = (target × total credits − current GPA × completed credits) ÷ remaining credits.",
  (v) => (n(v, "c") * (p(v, "b") + p(v, "d")) - n(v) * p(v, "b")) / p(v, "d"),
);
calc(
  "student",
  "Study Hours Calculator",
  [
    a("Chapters remaining", 12),
    b("Hours per chapter", 2),
    c("Days remaining", 8),
  ],
  "Required daily study hours = chapters × hours per chapter ÷ days.",
  (v) => (number(v.a, "Chapters", 0) * p(v, "b")) / p(v, "c"),
);
const ratios = [
  [
    "Accuracy Percentage Calculator",
    "student",
    "Correct answers",
    "Attempted answers",
  ],
  [
    "Attempt Rate Calculator",
    "student",
    "Attempted questions",
    "Total questions",
  ],
  [
    "Chapter Completion Calculator",
    "student",
    "Completed chapters",
    "Total chapters",
  ],
  ["Goal Progress Calculator", "office", "Completed amount", "Target amount"],
  ["Task Completion Percentage", "office", "Completed tasks", "Total tasks"],
];
for (const [name, cat, x, y] of ratios)
  calc(
    cat,
    name,
    [a(x, 25), b(y, 100)],
    `${x} ÷ ${y.toLowerCase()} × 100.`,
    (v) => (number(v.a, x, 0) / p(v, "b")) * 100,
  );
const salary = [
  [
    "Salary Per Day",
    [a("Monthly salary", 30000), b("Paid days in month", 30)],
    "Monthly salary ÷ paid days. Select calendar or working days according to your contract.",
    (v) => number(v.a, "Salary", 0) / p(v, "b"),
  ],
  [
    "Salary Per Hour",
    [a("Monthly salary", 30000), b("Paid days", 22), c("Hours per day", 8)],
    "Monthly salary ÷ (paid days × hours per day).",
    (v) => number(v.a, "Salary", 0) / (p(v, "b") * p(v, "c")),
  ],
  [
    "Salary Per Minute",
    [a("Monthly salary", 30000), b("Paid days", 22), c("Hours per day", 8)],
    "Monthly salary ÷ paid working minutes.",
    (v) => number(v.a, "Salary", 0) / (p(v, "b") * p(v, "c") * 60),
  ],
  [
    "Monthly-to-Annual Salary",
    [a("Monthly salary", 30000)],
    "Monthly salary × 12. Excludes bonuses unless included in your input.",
    (v) => number(v.a, "Salary", 0) * 12,
  ],
  [
    "Annual-to-Monthly Salary",
    [a("Annual salary", 600000)],
    "Annual salary ÷ 12. This is not take-home pay after deductions.",
    (v) => number(v.a, "Salary", 0) / 12,
  ],
  [
    "Salary Hike Calculator",
    [a("Current salary", 30000), b("Hike (%)", 15)],
    "New salary = current salary × (1 + hike ÷ 100).",
    (v) => number(v.a, "Salary", 0) * (1 + n(v, "b") / 100),
  ],
  [
    "Increment Percentage Calculator",
    [a("Old salary", 30000), b("New salary", 36000)],
    "(New − old) ÷ old × 100.",
    (v) => ((n(v, "b") - p(v)) / p(v)) * 100,
  ],
  [
    "Overtime Calculator",
    [a("Hourly pay", 200), b("Overtime hours", 10), c("Pay multiplier", 1.5)],
    "Hourly pay × overtime hours × multiplier. Enter the rate agreed by your employer.",
    (v) => number(v.a, "Pay", 0) * number(v.b, "Hours", 0) * p(v, "c"),
  ],
  [
    "Unpaid Leave Salary Deduction",
    [a("Monthly salary", 30000), b("Paid days", 30), c("Unpaid days", 2)],
    "Monthly salary ÷ paid days × unpaid days.",
    (v) => {
      if (n(v, "c") > p(v, "b"))
        throw Error("Unpaid days cannot exceed paid days.");
      return (number(v.a, "Salary", 0) / p(v, "b")) * number(v.c, "Days", 0);
    },
  ],
  [
    "Notice Period Buyout Calculator",
    [
      a("Monthly base salary", 30000),
      b("Salary divisor days", 30),
      c("Unserved notice days", 15),
    ],
    "Base salary ÷ divisor × unserved days. Your contract determines eligible components.",
    (v) => (number(v.a, "Salary", 0) / p(v, "b")) * number(v.c, "Days", 0),
  ],
  [
    "Bonus Percentage",
    [a("Annual salary", 600000), b("Bonus", 60000)],
    "Bonus ÷ annual salary × 100.",
    (v) => (number(v.b, "Bonus", 0) / p(v)) * 100,
  ],
  [
    "Leave Balance Calculator",
    [a("Opening balance", 12), b("Accrued leave", 6), c("Leave used", 5)],
    "Opening balance + accrued leave − used leave.",
    (v) => n(v) + n(v, "b") - n(v, "c"),
  ],
  [
    "Billable Hours Calculator",
    [a("Total working hours", 160), b("Billable utilization (%)", 75)],
    "Working hours × billable utilization ÷ 100.",
    (v) => (number(v.a, "Hours", 0) * percent(v, "b")) / 100,
  ],
  [
    "Hourly Rate Calculator",
    [
      a("Target monthly income", 100000),
      b("Monthly costs", 10000),
      c("Billable hours", 100),
    ],
    "(Target income + costs) ÷ billable hours.",
    (v) => (number(v.a, "Income", 0) + number(v.b, "Costs", 0)) / p(v, "c"),
  ],
  [
    "Project Rate Calculator",
    [
      a("Estimated hours", 40),
      b("Hourly rate", 1000),
      c("Contingency (%)", 15),
    ],
    "Hours × hourly rate × (1 + contingency ÷ 100).",
    (v) =>
      number(v.a, "Hours", 0) *
      number(v.b, "Rate", 0) *
      (1 + number(v.c, "Contingency", 0) / 100),
  ],
  [
    "Meeting Cost Calculator",
    [
      a("Attendees", 6),
      b("Average hourly pay", 500),
      c("Duration (minutes)", 45),
    ],
    "Attendees × average hourly pay × minutes ÷ 60.",
    (v) =>
      (I(v, "a", 1) * number(v.b, "Pay", 0) * number(v.c, "Minutes", 0)) / 60,
  ],
];
for (const [name, fields, formula, fn] of salary)
  calc("office", name, fields, formula, fn);

// Business math: users provide all rates; there is no invented live data.
const money = [
  [
    "Simple Interest Calculator",
    [a("Principal", 10000), b("Annual rate (%)", 8), c("Years", 3)],
    "Interest = principal × annual rate × years ÷ 100.",
    (v) =>
      (number(v.a, "Principal", 0) *
        number(v.b, "Rate", 0) *
        number(v.c, "Years", 0)) /
      100,
  ],
  [
    "Compound Interest Calculator",
    [
      a("Principal", 10000),
      b("Annual rate (%)", 8),
      c("Years", 3),
      f("d", "Compounds per year", 12),
    ],
    "Future value = principal × (1 + annual rate ÷ frequency)^ (frequency × years).",
    (v) =>
      number(v.a, "Principal", 0) *
      (1 + number(v.b, "Rate", 0) / 100 / I(v, "d", 1, 365)) **
        (I(v, "d", 1, 365) * number(v.c, "Years", 0)),
  ],
  [
    "Discount Calculator",
    [a("Original price", 1000), b("Discount (%)", 20)],
    "Final price = original × (1 − discount ÷ 100).",
    (v) => number(v.a, "Price", 0) * (1 - percent(v, "b") / 100),
  ],
  [
    "Profit Calculator",
    [a("Revenue", 1500), b("Total cost", 1000)],
    "Profit = revenue − total cost.",
    (v) => n(v) - n(v, "b"),
  ],
  [
    "Loss Calculator",
    [a("Cost", 1500), b("Sale proceeds", 1000)],
    "Loss = cost − sale proceeds. A negative value is a gain.",
    (v) => n(v) - n(v, "b"),
  ],
  [
    "Profit Percentage",
    [a("Selling price", 1500), b("Cost price", 1000)],
    "(Selling price − cost) ÷ cost × 100.",
    (v) => ((n(v) - p(v, "b")) / p(v, "b")) * 100,
  ],
  [
    "Margin Calculator",
    [a("Revenue", 1500), b("Cost", 1000)],
    "(Revenue − cost) ÷ revenue × 100.",
    (v) => ((p(v) - n(v, "b")) / p(v)) * 100,
  ],
  [
    "Markup Calculator",
    [a("Selling price", 1500), b("Cost", 1000)],
    "(Selling price − cost) ÷ cost × 100.",
    (v) => ((n(v) - p(v, "b")) / p(v, "b")) * 100,
  ],
  [
    "Selling Price Calculator",
    [a("Cost", 1000), b("Target margin (%)", 25)],
    "Selling price = cost ÷ (1 − target margin ÷ 100).",
    (v) =>
      number(v.a, "Cost", 0) / (1 - number(v.b, "Margin", 0, 99.9999) / 100),
  ],
  [
    "Cost Price Calculator",
    [a("Selling price", 1500), b("Margin (%)", 25)],
    "Cost = selling price × (1 − margin ÷ 100).",
    (v) => number(v.a, "Selling price", 0) * (1 - percent(v, "b") / 100),
  ],
  [
    "Break Even Calculator",
    [
      a("Fixed costs", 100000),
      b("Unit selling price", 500),
      c("Variable cost per unit", 300),
    ],
    "Break-even units = ceiling(fixed costs ÷ (price − variable cost)).",
    (v) => {
      const contribution = p(v, "b") - number(v.c, "Variable cost", 0);
      if (contribution <= 0) throw Error("Price must exceed variable cost.");
      return Math.ceil(number(v.a, "Fixed cost", 0) / contribution);
    },
  ],
  [
    "ROI Calculator",
    [a("Final value", 12000), b("Initial investment", 10000)],
    "(Final value − investment) ÷ investment × 100.",
    (v) => ((n(v) - p(v, "b")) / p(v, "b")) * 100,
  ],
  [
    "CAGR Calculator",
    [a("Beginning value", 10000), b("Ending value", 18000), c("Years", 5)],
    "((Ending ÷ beginning) ^ (1 ÷ years) − 1) × 100.",
    (v) => ((p(v, "b") / p(v)) ** (1 / p(v, "c")) - 1) * 100,
  ],
  [
    "Future Value Calculator",
    [a("Present value", 10000), b("Annual rate (%)", 8), c("Years", 10)],
    "Present value × (1 + annual rate)^years. Returns are assumptions, not guarantees.",
    (v) =>
      number(v.a, "Value", 0) *
      (1 + number(v.b, "Rate", -99.99) / 100) ** number(v.c, "Years", 0),
  ],
  [
    "Present Value Calculator",
    [a("Future value", 10000), b("Discount rate (%)", 8), c("Years", 10)],
    "Future value ÷ (1 + discount rate)^years.",
    (v) =>
      number(v.a, "Value", 0) /
      (1 + number(v.b, "Rate", -99.99) / 100) ** number(v.c, "Years", 0),
  ],
  [
    "Inflation Calculator",
    [a("Current cost", 10000), b("Annual inflation (%)", 6), c("Years", 10)],
    "Projected cost = current cost × (1 + inflation)^years. Uses your assumed rate.",
    (v) =>
      number(v.a, "Cost", 0) *
      (1 + number(v.b, "Rate", -99.99) / 100) ** number(v.c, "Years", 0),
  ],
  [
    "Emergency Fund Calculator",
    [a("Essential monthly spending", 25000), b("Months to cover", 6)],
    "Monthly essential spending × coverage months.",
    (v) => number(v.a, "Spending", 0) * p(v, "b"),
  ],
  [
    "Savings Goal Calculator",
    [a("Target", 100000), b("Already saved", 20000), c("Months remaining", 12)],
    "Monthly contribution = remaining goal ÷ months. Assumes no interest.",
    (v) => Math.max(0, n(v) - n(v, "b")) / p(v, "c"),
  ],
  [
    "Commission Calculator",
    [a("Sale value", 50000), b("Commission (%)", 5)],
    "Sale value × commission rate ÷ 100.",
    (v) => (number(v.a, "Sale", 0) * number(v.b, "Rate", 0)) / 100,
  ],
  [
    "Add GST",
    [a("Base amount", 1000), b("GST rate (%)", 18)],
    "Tax = base × rate ÷ 100; total = base + tax. Enter the applicable rate.",
    (v) => {
      const base = number(v.a, "Base", 0),
        tax = (base * number(v.b, "Rate", 0)) / 100;
      return `Tax: ${round(tax)}\nTotal: ${round(base + tax)}`;
    },
  ],
  [
    "Remove GST",
    [a("Tax-inclusive amount", 1180), b("GST rate (%)", 18)],
    "Base = inclusive amount ÷ (1 + rate ÷ 100).",
    (v) => {
      const total = number(v.a, "Total", 0),
        base = total / (1 + number(v.b, "Rate", 0) / 100);
      return `Base: ${round(base)}\nTax: ${round(total - base)}`;
    },
  ],
  [
    "Discount + GST Calculator",
    [a("Price", 1000), b("Discount (%)", 10), c("GST (%)", 18)],
    "Apply the discount first, then add GST to the discounted value.",
    (v) =>
      number(v.a, "Price", 0) *
      (1 - percent(v, "b") / 100) *
      (1 + number(v.c, "GST", 0) / 100),
  ],
  [
    "Down Payment Calculator",
    [a("Purchase price", 1000000), b("Down payment (%)", 20)],
    "Purchase price × down payment rate ÷ 100.",
    (v) => (number(v.a, "Price", 0) * percent(v, "b")) / 100,
  ],
  [
    "Debt-to-Income Calculator",
    [a("Monthly debt payments", 10000), b("Gross monthly income", 50000)],
    "Monthly debt payments ÷ gross monthly income × 100.",
    (v) => (number(v.a, "Debt", 0) / p(v, "b")) * 100,
  ],
];
for (const [name, fields, formula, fn] of money)
  calc("finance", name, fields, formula, fn);
export function loan(v) {
  const principal = p(v),
    rate = number(v.b, "Annual rate", 0) / 1200,
    months = integer(v.c, "Months", 1, 1200);
  const emi = rate
    ? (principal * rate) / (1 - (1 + rate) ** -months)
    : principal / months;
  return { principal, rate, months, emi };
}
calc(
  "finance",
  "EMI Calculator",
  [
    a("Loan principal", 500000),
    b("Annual interest (%)", 9),
    c("Tenure (months)", 60),
  ],
  "Fixed monthly installment = P × r ÷ (1 − (1+r)^−n). Assumes a reducing balance and no fees.",
  (v) => {
    const l = loan(v);
    return `Monthly EMI: ${round(l.emi)}\nInterest: ${round(l.emi * l.months - l.principal)}\nTotal repayment: ${round(l.emi * l.months)}`;
  },
);
calc(
  "finance",
  "Loan Repayment Schedule",
  [
    a("Loan principal", 500000),
    b("Annual interest (%)", 9),
    c("Tenure (months)", 60),
  ],
  "Monthly amortization schedule. Assumes fixed reducing-balance interest and no fees.",
  (v) => {
    const l = loan(v);
    let balance = l.principal;
    return (
      "Month,Payment,Interest,Principal,Balance\n" +
      Array.from({ length: l.months }, (_, i) => {
        const interest = balance * l.rate,
          principal = Math.min(balance, l.emi - interest),
          payment = interest + principal;
        balance = Math.max(0, balance - principal);
        return [
          i + 1,
          payment.toFixed(2),
          interest.toFixed(2),
          principal.toFixed(2),
          balance.toFixed(2),
        ].join(",");
      }).join("\n")
    );
  },
  { extension: "csv" },
);
calc(
  "finance",
  "SIP Mathematical Calculator",
  [
    a("Monthly contribution", 5000),
    b("Assumed annual return (%)", 10),
    c("Months", 120),
  ],
  "End-of-month contributions: contribution × ((1 + monthly rate)^months − 1) ÷ monthly rate. No guaranteed returns.",
  (v) => {
    const m = number(v.a, "Contribution", 0),
      r = number(v.b, "Return", 0) / 1200,
      months = I(v, "c", 1, 1200);
    return r ? (m * ((1 + r) ** months - 1)) / r : m * months;
  },
);
const metrics = [
  ["CPC Calculator", "Advertising spend", "Clicks", 1],
  ["CPM Calculator", "Advertising spend", "Impressions", 1000],
  ["CTR Calculator", "Clicks", "Impressions", 100],
  ["CPA Calculator", "Advertising spend", "Acquisitions", 1],
  ["ROAS Calculator", "Advertising revenue", "Advertising spend", 1],
  ["Conversion Rate", "Conversions", "Visitors", 100],
  ["Customer Acquisition Cost", "Acquisition spend", "New customers", 1],
  ["Average Order Value", "Revenue", "Orders", 1],
  ["Churn Rate", "Customers lost", "Customers at start", 100],
  ["Email Open Rate", "Unique opens", "Delivered emails", 100],
  ["Email CTR", "Unique clicks", "Delivered emails", 100],
  ["Return Rate Calculator", "Returned orders", "Total orders", 100],
  ["Employee Turnover Rate", "Departures", "Average workforce", 100],
  ["Absenteeism Rate", "Absent workdays", "Scheduled workdays", 100],
  ["ARPU Calculator", "Recurring revenue", "Active users", 1],
  ["Trial Conversion Calculator", "Paid conversions", "Trials", 100],
  ["Freemium Conversion Calculator", "Paying users", "Free users", 100],
  ["Cost Per User Calculator", "Total cost", "Users", 1],
  ["Food Cost Percentage Calculator", "Food cost", "Food revenue", 100],
  ["Cost Per Serving Calculator", "Recipe cost", "Servings", 1],
  ["Table Turnover Calculator", "Parties served", "Tables", 1],
  ["Event Cost Per Person Calculator", "Total event cost", "Guests", 1],
  ["CSAT Calculator", "Satisfied responses", "Total responses", 100],
  ["Context Window Usage Calculator", "Tokens used", "Context capacity", 100],
];
for (const [name, x, y, mult] of metrics)
  calc(
    "marketing",
    name,
    [a(x, 500), b(y, 10000)],
    `${x} ÷ ${y.toLowerCase()}${mult !== 1 ? ` × ${mult}` : ""}. Values come from your own data.`,
    (v) => (number(v.a, x, 0) / p(v, "b")) * mult,
  );
const startup = [
  [
    "Monthly Recurring Revenue",
    [
      a("Paying customers", 100),
      b("Average monthly revenue per customer", 500),
    ],
    "Customers × average recurring revenue per customer.",
    (v) => number(v.a, "Customers", 0) * number(v.b, "Revenue", 0),
  ],
  [
    "ARR Calculator",
    [a("Monthly recurring revenue", 50000)],
    "Annual recurring revenue = monthly recurring revenue × 12.",
    (v) => number(v.a, "MRR", 0) * 12,
  ],
  [
    "SaaS Runway Calculator",
    [a("Cash balance", 1000000), b("Monthly net burn", 100000)],
    "Cash balance ÷ positive monthly net burn, in months.",
    (v) => number(v.a, "Cash", 0) / p(v, "b"),
  ],
  [
    "Burn Rate Calculator",
    [a("Monthly expenses", 150000), b("Monthly cash income", 50000)],
    "Net burn = expenses − cash income. Negative values mean cash generation.",
    (v) => number(v.a, "Expenses", 0) - number(v.b, "Income", 0),
  ],
  [
    "Customer Lifetime Value",
    [
      a("Average monthly revenue per customer", 500),
      b("Gross margin (%)", 80),
      c("Monthly churn (%)", 5),
    ],
    "Simplified LTV = monthly revenue × gross margin ÷ monthly churn fraction. Assumes constant churn.",
    (v) =>
      (number(v.a, "Revenue", 0) * percent(v, "b")) /
      number(v.c, "Churn", 0.001, 100),
  ],
  [
    "NPS Calculator",
    [a("Promoters", 60), b("Detractors", 10), c("Total respondents", 100)],
    "(Promoters − detractors) ÷ total respondents × 100.",
    (v) => {
      const x = I(v),
        y = I(v, "b"),
        total = I(v, "c", 1);
      if (x + y > total)
        throw Error("Promoters plus detractors cannot exceed total.");
      return ((x - y) / total) * 100;
    },
  ],
  [
    "RICE Score Calculator",
    [
      a("Reach", 1000),
      b("Impact score", 2),
      c("Confidence (%)", 80),
      f("d", "Effort (person-months)", 4),
    ],
    "Reach × impact × confidence fraction ÷ effort.",
    (v) =>
      (number(v.a, "Reach", 0) * number(v.b, "Impact", 0) * percent(v, "c")) /
      100 /
      p(v, "d"),
  ],
  [
    "ICE Score Calculator",
    [a("Impact (1–10)", 8), b("Confidence (1–10)", 7), c("Ease (1–10)", 6)],
    "Average of impact, confidence and ease scores.",
    (v) =>
      (number(v.a, "Impact", 1, 10) +
        number(v.b, "Confidence", 1, 10) +
        number(v.c, "Ease", 1, 10)) /
      3,
  ],
  [
    "Net Revenue Retention Calculator",
    [
      a("Starting MRR", 10000),
      b("Expansion MRR", 2000),
      c("Churn + contraction MRR", 500),
    ],
    "(Starting + expansion − losses) ÷ starting × 100.",
    (v) =>
      ((p(v) + number(v.b, "Expansion", 0) - number(v.c, "Losses", 0)) / p(v)) *
      100,
  ],
  [
    "Gross Revenue Retention Calculator",
    [a("Starting MRR", 10000), b("Churn + contraction MRR", 500)],
    "(Starting − losses) ÷ starting × 100; excludes expansion.",
    (v) => {
      if (n(v, "b") > p(v)) throw Error("Losses cannot exceed starting MRR.");
      return ((p(v) - number(v.b, "Losses", 0)) / p(v)) * 100;
    },
  ],
  [
    "Inventory Turnover",
    [a("Cost of goods sold", 500000), b("Average inventory value", 100000)],
    "Cost of goods sold ÷ average inventory value for the same period.",
    (v) => number(v.a, "Cost", 0) / p(v, "b"),
  ],
  [
    "Reorder Point Calculator",
    [
      a("Average daily demand", 10),
      b("Lead time (days)", 7),
      c("Safety stock", 20),
    ],
    "Daily demand × lead time + safety stock.",
    (v) =>
      number(v.a, "Demand", 0) * number(v.b, "Lead time", 0) +
      number(v.c, "Safety stock", 0),
  ],
  [
    "AI API Cost Calculator",
    [
      a("Input tokens", 100000),
      b("Input price per million tokens", 1),
      c("Output tokens", 20000),
      f("d", "Output price per million tokens", 4),
    ],
    "Input tokens × input price ÷ 1,000,000 + output tokens × output price ÷ 1,000,000. Enter your provider’s current prices.",
    (v) =>
      (number(v.a, "Input", 0) * number(v.b, "Price", 0) +
        number(v.c, "Output", 0) * number(v.d, "Price", 0)) /
      1e6,
  ],
];
for (const [name, fields, formula, fn] of startup)
  calc("marketing", name, fields, formula, fn);

// Unit converters. Exact definitions are used; digital units here are decimal.
const units = [
  ["KM", "Miles", 0.621371192237334],
  ["Miles", "KM", 1.609344],
  ["Meter", "Feet", 1 / 0.3048],
  ["Feet", "Meter", 0.3048],
  ["Inch", "CM", 2.54],
  ["CM", "Inch", 1 / 2.54],
  ["KG", "Pounds", 1 / 0.45359237],
  ["Pounds", "KG", 0.45359237],
  ["Gram", "KG", 0.001],
  ["Ounce", "Gram", 28.349523125],
  ["Sq Ft", "Sq Meter", 0.09290304],
  ["Sq Meter", "Sq Ft", 1 / 0.09290304],
  ["Acre", "Sq Ft", 43560],
  ["Hectare", "Acre", 10000 / 4046.8564224],
  ["Liter", "ML", 1000],
  ["Gallon", "Liter", 3.785411784],
  ["Cup", "ML", 236.5882365],
  ["Tablespoon", "ML", 14.78676478125],
  ["Teaspoon", "ML", 4.92892159375],
  ["KM/H", "MPH", 1 / 1.609344],
  ["MPH", "KM/H", 1.609344],
  ["KB", "MB", 0.001],
  ["MB", "GB", 0.001],
  ["GB", "TB", 0.001],
  ["Bytes", "KB", 0.001],
  ["Gaj", "Square Feet", 9],
  ["Square Feet", "Gaj", 1 / 9],
  ["Guntha", "Square Feet", 1089],
  ["Square Feet", "Guntha", 1 / 1089],
  ["Cent", "Square Feet", 435.6],
  ["Decimal", "Square Feet", 435.6],
  ["Acre", "Gaj", 4840],
  ["Square Yard", "Gaj", 1],
  ["Crore", "Million", 10],
  ["Million", "Crore", 0.1],
  ["Lakh", "Crore", 0.01],
  ["Degrees", "Radians", Math.PI / 180],
  ["Radians", "Degrees", 180 / Math.PI],
];
for (const [from, to, factor] of units)
  calc(
    "converters",
    `${from} to ${to}`,
    [a(from, 1)],
    `${to} = ${from} × ${factor}. ${from === "Gallon" ? "Uses the US liquid gallon. " : ""}${["Cup", "Tablespoon", "Teaspoon"].includes(from) ? "Uses US customary cooking measures. " : ""}${["KB", "MB", "GB", "Bytes"].includes(from) ? "Decimal units: 1 KB = 1,000 bytes." : ""}`,
    (v) => n(v) * factor,
  );
for (const [from, to, fn, formula, min] of [
  [
    "Celsius",
    "Fahrenheit",
    (x) => (x * 9) / 5 + 32,
    "°F = °C × 9/5 + 32.",
    -273.15,
  ],
  [
    "Fahrenheit",
    "Celsius",
    (x) => ((x - 32) * 5) / 9,
    "°C = (°F − 32) × 5/9.",
    -459.67,
  ],
  ["Celsius", "Kelvin", (x) => x + 273.15, "K = °C + 273.15.", -273.15],
  ["Kelvin", "Celsius", (x) => x - 273.15, "°C = K − 273.15.", 0],
])
  calc(
    "converters",
    `${from} to ${to}`,
    [a(from, from === "Kelvin" ? 273.15 : 0)],
    formula,
    (v) => fn(number(v.a, from, min)),
  );

// Dates use UTC calendar days, so daylight-saving changes do not alter day counts.
const dates = [
  f("start", "Start date", "2026-01-01", "date"),
  f("end", "End date", "2026-12-31", "date"),
];
calc(
  "date-time",
  "Date Difference Calculator",
  dates,
  "Elapsed days between two dates, excluding the end date. Uses UTC calendar arithmetic.",
  (v) => (date(v.end) - date(v.start)) / DAY,
);
calc(
  "date-time",
  "Age Calculator",
  [
    f("start", "Date of birth", "2000-01-15", "date"),
    f("end", "As-of date", "2026-10-22", "date"),
  ],
  "Completed years, months and days at your chosen date. End-of-month anniversaries are clamped to the last valid day.",
  (v) => {
    const start = date(v.start),
      end = date(v.end);
    if (end < start) throw Error("As-of date must be after birth.");
    let months =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      end.getUTCMonth() -
      start.getUTCMonth();
    const add = (m) => {
      const d = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1),
      );
      d.setUTCDate(
        Math.min(
          start.getUTCDate(),
          new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
          ).getUTCDate(),
        ),
      );
      return d;
    };
    if (add(months) > end) months--;
    return `${Math.floor(months / 12)} years, ${months % 12} months, ${(end - add(months)) / DAY} days`;
  },
);
calc(
  "date-time",
  "Add Days to Date",
  [
    f("start", "Start date", "2026-10-22", "date"),
    a("Days to add (negative subtracts)", 30),
  ],
  "Add signed whole calendar days to a date.",
  (v) =>
    iso(new Date(+date(v.start) + integer(v.a, "Days", -100000, 100000) * DAY)),
);
calc(
  "date-time",
  "Day of Week Finder",
  [f("start", "Date", "2026-10-22", "date")],
  "Find the weekday for a Gregorian calendar date.",
  (v) =>
    date(v.start).toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }),
);
calc(
  "date-time",
  "Week Number Calculator",
  [f("start", "Date", "2026-10-22", "date")],
  "ISO 8601 week number: weeks start Monday and week 1 contains January 4.",
  (v) => {
    const d = date(v.start);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const year = d.getUTCFullYear();
    return `${year}-W${String(Math.ceil(((d - new Date(Date.UTC(year, 0, 1))) / DAY + 1) / 7)).padStart(2, "0")}`;
  },
);
calc(
  "date-time",
  "Business Days Calculator",
  dates,
  "Count Monday–Friday dates in the half-open interval [start, end). Public holidays are not included.",
  (v) => {
    const start = date(v.start),
      end = date(v.end);
    if (end < start) throw Error("End must follow start.");
    const days = (end - start) / DAY;
    if (days > 100000) throw Error("Choose a range below 100,000 days.");
    let total = 0;
    for (let d = +start; d < +end; d += DAY)
      if (![0, 6].includes(new Date(d).getUTCDay())) total++;
    return total;
  },
);
calc(
  "date-time",
  "Unix Timestamp Converter",
  [a("Unix timestamp (seconds)", 1767225600)],
  "Convert Unix seconds (not milliseconds) into an ISO 8601 UTC datetime.",
  (v) => {
    const d = new Date(n(v) * 1000);
    if (!Number.isFinite(+d)) throw Error("Timestamp is out of range.");
    return d.toISOString();
  },
);
calc(
  "date-time",
  "ISO Date Converter",
  [f("text", "ISO datetime with timezone", "2026-01-01T00:00:00Z", "text")],
  "Convert an ISO datetime with explicit offset or Z into Unix seconds and normalized UTC.",
  (v) => {
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v.text))
      throw Error("Use an ISO datetime with Z or a timezone offset.");
    const d = new Date(v.text);
    if (!Number.isFinite(+d)) throw Error("Invalid datetime.");
    return `${d.toISOString()}\nUnix seconds: ${+d / 1000}`;
  },
);
function minutes(s) {
  if (!/^\d{2}:\d{2}$/.test(s)) throw Error("Use HH:MM.");
  const [h, m] = s.split(":").map(Number);
  if (h > 23 || m > 59) throw Error("Invalid time.");
  return h * 60 + m;
}
calc(
  "office",
  "Working Hours Calculator",
  [
    f("start", "Start time", "09:00", "time"),
    f("end", "End time", "17:30", "time"),
    a("Unpaid break (minutes)", 30),
  ],
  "Duration minus unpaid breaks. An end before start is treated as the following day.",
  (v) => {
    let duration = minutes(v.end) - minutes(v.start);
    if (duration < 0) duration += 1440;
    const net = duration - number(v.a, "Break", 0, 1440);
    if (net < 0) throw Error("Break exceeds shift duration.");
    return `${Math.floor(net / 60)}h ${net % 60}m (${round(net / 60)} hours)`;
  },
);
calc(
  "date-time",
  "Time Duration Calculator",
  [f("text", "Durations, HH:MM, one per line", "01:30\n02:45", "textarea")],
  "Add durations. Hours can exceed 24; minutes must be 0–59.",
  (v) => {
    const total = v.text
      .trim()
      .split(/\n/)
      .reduce((s, line) => {
        if (!/^\d{1,6}:[0-5]\d$/.test(line.trim()))
          throw Error("Each line must use HH:MM.");
        const [h, m] = line.split(":").map(Number);
        return s + h * 60 + m;
      }, 0);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  },
);

// Text tools are Unicode-aware and never send the input to a server.
const words = (s) =>
  s.trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
const lines = (s) => s.replace(/\r\n?/g, "\n").split("\n");
const transforms = [
  [
    "Word Counter",
    (s) => ({
      Words: words(s).length,
      Characters: Array.from(s).length,
      "Without whitespace": Array.from(s.replace(/\s/gu, "")).length,
      Lines: s ? lines(s).length : 0,
    }),
    "Count Unicode words, code points and lines. Hyphenated words count as one.",
  ],
  [
    "Character Counter",
    (s) => ({
      "Unicode characters": Array.from(s).length,
      "UTF-16 code units": s.length,
      "UTF-8 bytes": new TextEncoder().encode(s).length,
    }),
    "Count Unicode code points, UTF-16 code units and UTF-8 bytes.",
  ],
  [
    "Uppercase Converter",
    (s) => s.toLocaleUpperCase(),
    "Convert text to uppercase.",
  ],
  [
    "Lowercase Converter",
    (s) => s.toLocaleLowerCase(),
    "Convert text to lowercase.",
  ],
  [
    "Title Case Converter",
    (s) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()),
    "Capitalize the first letter of each word; does not apply editorial style exceptions.",
  ],
  [
    "Sentence Case Converter",
    (s) =>
      s
        .toLowerCase()
        .replace(/(^|[.!?]\s+)(\p{L})/gu, (_, p, c) => p + c.toUpperCase()),
    "Capitalize the first letter after sentence-ending punctuation.",
  ],
  [
    "Text Reverser",
    (s) => Array.from(s).reverse().join(""),
    "Reverse Unicode code points. Combined emoji sequences may separate.",
  ],
  [
    "Word Reverser",
    (s) => s.trim().split(/\s+/).reverse().join(" "),
    "Reverse the order of whitespace-separated words.",
  ],
  [
    "Remove Extra Spaces",
    (s) =>
      s
        .split("\n")
        .map((l) => l.trim().replace(/[\t ]+/g, " "))
        .join("\n")
        .trim(),
    "Collapse horizontal whitespace while preserving line breaks.",
  ],
  [
    "Remove Line Breaks",
    (s) => s.replace(/\s*\r?\n\s*/g, " ").trim(),
    "Join lines with single spaces.",
  ],
  [
    "Remove Empty Lines",
    (s) =>
      lines(s)
        .filter((l) => l.trim())
        .join("\n"),
    "Delete lines that contain only whitespace.",
  ],
  [
    "Duplicate Line Remover",
    (s) => [...new Set(lines(s))].join("\n"),
    "Keep the first exact occurrence of each line. Comparison is case-sensitive.",
  ],
  [
    "Duplicate Word Remover",
    (s) => [...new Set(s.trim().split(/\s+/))].join(" "),
    "Remove repeated whitespace-separated words. Comparison is case-sensitive.",
  ],
  [
    "Alphabetical Sorter",
    (s) =>
      lines(s)
        .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
        .join("\n"),
    "Sort one entry per line using English collation and numeric ordering.",
  ],
  [
    "Line Counter",
    (s) => (s ? lines(s).length : 0),
    "Count lines, including a final empty line after a trailing line break.",
  ],
  [
    "Sentence Counter",
    (s) =>
      (s.match(/[^.!?]+(?:[.!?]+|$)/g) || []).filter((s) => s.trim()).length,
    "Estimate sentences using periods, question marks and exclamation marks. Abbreviations may affect counts.",
  ],
  [
    "Paragraph Counter",
    (s) => (s.trim() ? s.trim().split(/\n\s*\n/).length : 0),
    "Count blocks separated by at least one blank line.",
  ],
  [
    "Slug Generator",
    (s) => slugify(s),
    "Make a lowercase, hyphenated ASCII slug. Non-Latin letters are omitted.",
  ],
  [
    "Text to HTML",
    (s) =>
      lines(s)
        .map((l) => `<p>${escapeHTML(l)}</p>`)
        .join("\n"),
    "Escape user text and wrap each line in a paragraph. Output is code, not executed markup.",
  ],
  [
    "HTML Escape Tool",
    (s) => escapeHTML(s),
    "Escape ampersands, brackets and quotes as HTML entities.",
  ],
  [
    "HTML Decoder",
    (s) =>
      s.replace(/&(?:amp|lt|gt|quot|#39|#x[0-9a-f]+|#\d+);/gi, (e) => {
        const map = {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&#39;": "'",
        };
        if (map[e]) return map[e];
        const x = e.slice(2, -1),
          code =
            x[0].toLowerCase() === "x" ? parseInt(x.slice(1), 16) : Number(x);
        if (code > 0x10ffff || code < 0) throw Error("Invalid entity.");
        return String.fromCodePoint(code);
      }),
    "Decode common HTML entities and decimal/hex numeric entities; output remains plain text.",
  ],
  [
    "URL Encoder",
    (s) => encodeURIComponent(s),
    "Percent-encode a URL component, including spaces and reserved characters.",
  ],
  [
    "URL Decoder",
    (s) => decodeURIComponent(s.replaceAll("+", " ")),
    "Decode percent escapes; plus signs are treated as spaces (form encoding).",
  ],
  [
    "Base64 Encoder",
    (s) => {
      const bytes = new TextEncoder().encode(s);
      return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
    },
    "Encode UTF-8 text as standard Base64.",
  ],
  [
    "Base64 Decoder",
    (s) => {
      const raw = atob(s.replace(/\s/g, ""));
      return new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      );
    },
    "Decode standard Base64 as UTF-8; rejects invalid UTF-8 data.",
  ],
  [
    "Text to ASCII",
    (s) => {
      if (Array.from(s).some((c) => c.codePointAt(0) > 127))
        throw Error(
          "Input contains non-ASCII characters. Use Unicode Converter for those.",
        );
      return Array.from(s, (c) => c.charCodeAt(0)).join(" ");
    },
    "Convert ASCII characters (0–127) to decimal character codes.",
  ],
  [
    "ASCII to Text",
    (s) =>
      list(s)
        .map((x) => String.fromCharCode(integer(x, "ASCII code", 0, 127)))
        .join(""),
    "Convert decimal ASCII codes (0–127) into text.",
  ],
  [
    "Unicode Converter",
    (s) =>
      Array.from(
        s,
        (c) =>
          "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"),
      ).join(" "),
    "Show each Unicode code point in U+ notation.",
  ],
  [
    "Hashtag Counter",
    (s) => ({
      Count: (s.match(/#[\p{L}\p{N}_]+/gu) || []).length,
      Hashtags: (s.match(/#[\p{L}\p{N}_]+/gu) || []).join(" "),
    }),
    "Find hashtags made of Unicode letters, numbers and underscores.",
  ],
  [
    "Hashtag Formatter",
    (s) =>
      [
        ...new Set(
          s
            .split(/[\s,]+/)
            .filter(Boolean)
            .map((w) => "#" + w.replace(/[^\p{L}\p{N}_]/gu, "")),
        ),
      ]
        .filter((w) => w !== "#")
        .join(" "),
    "Turn comma/space-separated keywords into unique hashtags.",
  ],
  [
    "WhatsApp Bold Text",
    (s) => `*${s}*`,
    "Wrap text with WhatsApp bold markers.",
  ],
  [
    "WhatsApp Italic Text",
    (s) => `_${s}_`,
    "Wrap text with WhatsApp italic markers.",
  ],
  [
    "WhatsApp Strikethrough",
    (s) => `~${s}~`,
    "Wrap text with WhatsApp strikethrough markers.",
  ],
  [
    "Name Initial Generator",
    (s) =>
      words(s)
        .map((w) => Array.from(w)[0].toUpperCase())
        .join(""),
    "Take the first letter of each part of a name.",
  ],
  [
    "File Name Cleaner",
    (s) =>
      s
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
        .replace(/[. ]+$/, "")
        .trim() || "untitled",
    "Replace characters disallowed in Windows filenames. Check reserved device names before saving.",
  ],
  [
    "Email Address Format Checker",
    (s) => ({
      format: /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(s.trim())
        ? "Plausible format"
        : "Invalid format",
      note: "Format check only; does not verify mailbox ownership, deliverability or existence.",
    }),
    "Check basic email syntax without contacting a mail server.",
  ],
];
for (const [name, fn, formula] of transforms)
  calc(
    [
      "Base64",
      "URL ",
      "HTML ",
      "ASCII",
      "Text to ASCII",
      "Unicode",
      "File Name",
    ].some((p) => name.startsWith(p))
      ? "developer"
      : "text",
    name,
    [text()],
    formula,
    (v) => fn(v.text),
  );
calc(
  "text",
  "Reading Time Calculator",
  [
    text("Read clearly, write simply, and keep learning."),
    a("Words per minute", 200),
  ],
  "Reading time = Unicode word count ÷ your reading speed.",
  (v) => `${round(words(v.text).length / p(v))} minutes`,
);
calc(
  "text",
  "Speaking Time Calculator",
  [text("Welcome to our presentation."), a("Words per minute", 130)],
  "Speaking time = word count ÷ speaking speed. Pauses are not included.",
  (v) => `${round(words(v.text).length / p(v))} minutes`,
);
calc(
  "text",
  "Word Frequency Counter",
  [text("Tools make work easier. Useful tools save time.")],
  "Count words case-insensitively and sort by frequency.",
  (v) => {
    const counts = Object.create(null);
    for (const word of words(v.text.toLowerCase()))
      counts[word] = (Object.hasOwn(counts, word) ? counts[word] : 0) + 1;
    return Object.fromEntries(
      Object.entries(counts).sort((a, b) => b[1] - a[1]),
    );
  },
);
calc(
  "text",
  "Find and Replace",
  [
    text(),
    f("find", "Find (literal text)", "world", "text"),
    f("replace", "Replace with", "everyone", "text"),
  ],
  "Replace all exact, case-sensitive matches. No regular expressions are evaluated.",
  (v) => {
    if (!v.find) throw Error("Find text is required.");
    return v.text.split(v.find).join(v.replace);
  },
);
const MORSE =
  "A .-|B -...|C -.-.|D -..|E .|F ..-.|G --.|H ....|I ..|J .---|K -.-|L .-..|M --|N -.|O ---|P .--.|Q --.-|R .-.|S ...|T -|U ..-|V ...-|W .--|X -..-|Y -.--|Z --..|0 -----|1 .----|2 ..---|3 ...--|4 ....-|5 .....|6 -....|7 --...|8 ---..|9 ----."
    .split("|")
    .map((x) => x.split(" "));
calc(
  "text",
  "Morse Code Converter",
  [
    text("HELLO WORLD"),
    f("mode", "Direction", "encode", "select", ["encode", "decode"]),
  ],
  "International Morse for A–Z and 0–9. Letters are space-separated; words use /. Unsupported characters are rejected.",
  (v) => {
    const map = Object.fromEntries(
      MORSE.map(([a, b]) => (v.mode === "decode" ? [b, a] : [a, b])),
    );
    return v.mode === "decode"
      ? v.text
          .trim()
          .split(/\s*\/\s*/)
          .map((w) =>
            w
              .split(/\s+/)
              .map((c) => {
                if (!map[c]) throw Error("Unsupported Morse sequence.");
                return map[c];
              })
              .join(""),
          )
          .join(" ")
      : v.text
          .toUpperCase()
          .trim()
          .split(/\s+/)
          .map((w) =>
            Array.from(w, (c) => {
              if (!map[c]) throw Error("Use letters A–Z and digits only.");
              return map[c];
            }).join(" "),
          )
          .join(" / ");
  },
);
for (const [name, base, encode] of [
  ["Binary to Decimal", 2, false],
  ["Decimal to Binary", 2, true],
  ["Hex to Decimal", 16, false],
  ["Decimal to Hex", 16, true],
  ["Octal to Decimal", 8, false],
  ["Decimal to Octal", 8, true],
])
  calc(
    "developer",
    name,
    [
      f(
        "text",
        "Integer",
        encode ? "42" : base === 2 ? "101010" : base === 8 ? "52" : "2a",
        "text",
      ),
    ],
    `Convert whole numbers using base ${base}. Supports arbitrarily large integers.`,
    (v) => {
      const s = v.text.trim();
      if (s.length > 10000) throw Error("Use fewer than 10,000 digits.");
      if (encode) {
        if (!/^\d+$/.test(s))
          throw Error("Enter a nonnegative decimal integer.");
        return BigInt(s).toString(base);
      }
      const re =
        base === 2 ? /^[01]+$/ : base === 8 ? /^[0-7]+$/ : /^[0-9a-f]+$/i;
      if (!re.test(s)) throw Error("Invalid digits for this base.");
      return BigInt(
        (base === 2 ? "0b" : base === 8 ? "0o" : "0x") + s,
      ).toString();
    },
  );
for (const [name, fn] of [
  ["JSON Formatter", (s) => JSON.stringify(JSON.parse(s), null, 2)],
  ["JSON Minifier", (s) => JSON.stringify(JSON.parse(s))],
  [
    "JSON Validator",
    (s) => {
      JSON.parse(s);
      return "Valid JSON";
    },
  ],
])
  calc(
    "developer",
    name,
    [text('{"name":"AllToolNexa","free":true}')],
    "Parse JSON with strict JSON syntax. Invalid input displays an error.",
    (v) => fn(v.text),
    { extension: "json" },
  );
calc(
  "developer",
  "JSON to CSV",
  [text('[{"name":"Asha","score":90},{"name":"Ravi","score":85}]')],
  "Convert an array of flat JSON objects to quoted CSV. Nested values are serialized as JSON.",
  (v) => {
    const rows = JSON.parse(v.text);
    if (
      !Array.isArray(rows) ||
      rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))
    )
      throw Error("Enter an array of objects.");
    const keys = [...new Set(rows.flatMap(Object.keys))];
    return [
      keys.map(csvCell).join(","),
      ...rows.map((r) =>
        keys
          .map((k) =>
            csvCell(typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k]),
          )
          .join(","),
      ),
    ].join("\n");
  },
  { extension: "csv" },
);
calc(
  "developer",
  "CSV to JSON",
  [text("name,score\nAsha,90\nRavi,85")],
  "Use the first row as unique column headings; cell values remain strings. Handles quoted commas and line breaks.",
  (v) => {
    const [header, ...rows] = csvRows(v.text);
    if (!header || new Set(header).size !== header.length)
      throw Error("CSV requires unique column headings.");
    if (rows.some((r) => r.length !== header.length))
      throw Error("All rows must have the same number of columns.");
    return JSON.stringify(
      rows.map((r) => Object.fromEntries(header.map((k, i) => [k, r[i]]))),
      null,
      2,
    );
  },
  { extension: "json" },
);
calc(
  "developer",
  "CSV Formatter",
  [text("name,score\nAsha,90\nRavi,85")],
  "Parse and re-emit CSV with quoted cells and consistent line breaks.",
  (v) =>
    csvRows(v.text)
      .map((r) => r.map(csvCell).join(","))
      .join("\n"),
  { extension: "csv" },
);
calc(
  "developer",
  "JWT Decoder",
  [text("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature")],
  "Decode the header and payload of a JWT. This does not verify its signature or trustworthiness.",
  (v) => {
    const parts = v.text.trim().split(".");
    if (parts.length !== 3)
      throw Error("JWT must have three dot-separated segments.");
    const decode = (s) => {
      const raw = atob(s.replaceAll("-", "+").replaceAll("_", "/"));
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(raw, (c) => c.charCodeAt(0)),
        ),
      );
    };
    return {
      header: decode(parts[0]),
      payload: decode(parts[1]),
      warning: "Signature NOT verified",
    };
  },
);
calc(
  "developer",
  "Query String Parser",
  [text("name=Asha&tag=tools&tag=free")],
  "Parse URL query parameters and preserve repeated keys as arrays.",
  (v) => {
    const p = new URLSearchParams(v.text.replace(/^\?/, ""));
    return Object.fromEntries(
      [...new Set(p.keys())].map((k) => [
        k,
        p.getAll(k).length > 1 ? p.getAll(k) : p.get(k),
      ]),
    );
  },
);
calc(
  "developer",
  "URL Parser",
  [f("text", "URL", "https://example.com:8080/path?q=tools#section", "text")],
  "Inspect protocol, host, port, pathname, query and fragment without making a network request.",
  (v) => {
    const u = httpURL(v.text);
    return {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      query: u.search,
      fragment: u.hash,
    };
  },
);
calc(
  "developer",
  "Domain Extractor",
  [f("text", "URL", "https://www.example.com/tools", "text")],
  "Extract the hostname from an HTTP(S) URL. Does not perform a WHOIS or availability lookup.",
  (v) => httpURL(v.text).hostname,
);
calc(
  "developer",
  "URL Cleaner",
  [
    f(
      "text",
      "URL",
      "https://example.com/?utm_source=newsletter&item=1",
      "text",
    ),
  ],
  "Remove common tracking parameters (utm_*, fbclid, gclid, msclkid) while preserving other parameters.",
  (v) => {
    const u = httpURL(v.text);
    for (const k of [...u.searchParams.keys()])
      if (/^utm_/i.test(k) || ["fbclid", "gclid", "msclkid"].includes(k))
        u.searchParams.delete(k);
    return u.toString();
  },
);
calc(
  "seo",
  "UTM URL Generator",
  [
    f("url", "Destination URL", "https://example.com/", "text"),
    f("source", "Campaign source", "newsletter", "text"),
    f("medium", "Campaign medium", "email", "text"),
    f("campaign", "Campaign name", "launch", "text"),
  ],
  "Add URL-encoded campaign source, medium and name to your destination URL.",
  (v) => {
    const u = httpURL(v.url);
    for (const k of ["source", "medium", "campaign"]) {
      if (!v[k].trim()) throw Error("All campaign fields are required.");
      u.searchParams.set("utm_" + k, v[k].trim());
    }
    return u.toString();
  },
);
calc(
  "seo",
  "WhatsApp Link Generator",
  [
    f(
      "phone",
      "International phone number (digits only)",
      "919876543210",
      "text",
    ),
    f("text", "Message", "Hello!", "textarea"),
  ],
  "Create a wa.me link from an international number and URL-encoded message. No message is sent automatically.",
  (v) => {
    if (!/^[1-9]\d{6,14}$/.test(v.phone))
      throw Error(
        "Enter 7–15 international digits without +, spaces or leading zero.",
      );
    return `https://wa.me/${v.phone}?text=${encodeURIComponent(v.text)}`;
  },
);
calc(
  "seo",
  "mailto Generator",
  [
    f("email", "Recipient", "hello@example.com", "email"),
    f("subject", "Subject", "Hello", "text"),
    text("I would like to get in touch."),
  ],
  "Build an encoded mailto link. Nothing is sent until you open and send it in your mail app.",
  (v) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
      throw Error("Enter a valid recipient address.");
    return `mailto:${encodeURIComponent(v.email).replaceAll("%40", "@")}?subject=${encodeURIComponent(v.subject)}&body=${encodeURIComponent(v.text)}`;
  },
);
for (const [name, limit] of [
  ["Title Length Checker", 60],
  ["Description Length Checker", 160],
  ["Instagram Character Counter", 2200],
  ["YouTube Title Length Checker", 100],
  ["LinkedIn Character Counter", 3000],
  ["Google Play Title Length Checker", 30],
  ["Short Description Length Checker", 80],
  ["Alt Text Length Checker", 125],
])
  calc(
    "seo",
    name,
    [text()],
    `Count Unicode characters against a reference of ${limit}. This is a configurable editorial guide, not a promise of search ranking or a platform policy check.`,
    (v) => {
      const count = Array.from(v.text).length;
      return { characters: count, reference: limit, difference: limit - count };
    },
  );
calc(
  "seo",
  "Keyword Density Checker",
  [
    text("Free tools help everyone. These tools run locally."),
    f("keyword", "Keyword or phrase", "tools", "text"),
  ],
  "Count exact case-insensitive word-sequence matches. Density = occurrences ÷ word count × 100. No SEO score is inferred.",
  (v) => {
    const ws = words(v.text.toLowerCase()),
      needle = words(v.keyword.toLowerCase());
    if (!needle.length) throw Error("Enter a keyword.");
    let count = 0;
    for (let i = 0; i <= ws.length - needle.length; i++)
      if (needle.every((s, j) => ws[i + j] === s)) count++;
    return {
      words: ws.length,
      occurrences: count,
      density: ws.length ? round((count / ws.length) * 100) : 0,
    };
  },
);
calc(
  "seo",
  "Meta Tag Generator",
  [
    f("title", "Page title", "My useful page", "text"),
    f(
      "description",
      "Description",
      "A helpful description of this page.",
      "textarea",
    ),
    f("url", "Canonical URL", "https://example.com/page", "text"),
  ],
  "Generate escaped title, description, canonical and Open Graph tags. Review before adding to your page.",
  (v) => {
    const url = httpURL(v.url).toString();
    return `<title>${escapeHTML(v.title)}</title>\n<meta name="description" content="${escapeHTML(v.description)}">\n<link rel="canonical" href="${escapeHTML(url)}">\n<meta property="og:title" content="${escapeHTML(v.title)}">\n<meta property="og:description" content="${escapeHTML(v.description)}">\n<meta property="og:url" content="${escapeHTML(url)}">`;
  },
  { extension: "html" },
);
calc(
  "seo",
  "YouTube URL Parser",
  [
    f(
      "text",
      "YouTube URL",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "text",
    ),
  ],
  "Extract a video ID from standard, short, embed or Shorts URLs. Does not fetch video statistics.",
  (v) => {
    const u = httpURL(v.text),
      host = u.hostname.replace(/^www\./, "");
    if (!["youtube.com", "m.youtube.com", "youtu.be"].includes(host))
      throw Error("Enter a YouTube URL.");
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1)
        : u.searchParams.get("v") || u.pathname.split("/")[2];
    if (!/^[A-Za-z0-9_-]{11}$/.test(id || ""))
      throw Error("Could not find an 11-character video ID.");
    return { videoId: id, url: `https://www.youtube.com/watch?v=${id}` };
  },
);

// India-specific formatting; format checks are explicitly not identity validation.
for (const [name, re, note, sample] of [
  [
    "PAN Format Checker",
    /^[A-Z]{5}\d{4}[A-Z]$/,
    "Checks structure only; does not verify issuance or identity.",
    "ABCDE1234F",
  ],
  [
    "GST Number Format Checker",
    /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
    "Checks structure only; does not verify checksum, registration or status.",
    "27ABCDE1234F1Z5",
  ],
  [
    "IFSC Format Checker",
    /^[A-Z]{4}0[A-Z0-9]{6}$/,
    "Checks structure only; does not verify branch existence.",
    "SBIN0001234",
  ],
  [
    "Pincode Formatter",
    /^[1-9]\d{5}$/,
    "Checks a six-digit Indian PIN format; does not locate a post office.",
    "110001",
  ],
])
  calc("india", name, [f("text", "Value", sample, "text")], note, (v) => ({
    format: re.test(v.text.trim().toUpperCase())
      ? "Valid format"
      : "Invalid format",
    note,
  }));
calc(
  "india",
  "Aadhaar Masking Tool",
  [f("text", "12-digit Aadhaar (processed locally)", "123456789012", "text")],
  "Show only the last four digits. Does not validate Aadhaar or save the input.",
  (v) => {
    const s = v.text.replace(/[ -]/g, "");
    if (!/^\d{12}$/.test(s)) throw Error("Enter exactly 12 digits.");
    return `XXXX XXXX ${s.slice(-4)}`;
  },
);
calc(
  "india",
  "Indian Mobile Number Formatter",
  [f("text", "Indian mobile number", "9876543210", "text")],
  "Normalize a 10-digit Indian mobile number beginning 6–9 to +91 format. Format check only.",
  (v) => {
    const s = v.text.replace(/\D/g, "").replace(/^(?:0091|91)(?=\d{10}$)/, "");
    if (!/^[6-9]\d{9}$/.test(s))
      throw Error("Enter a valid Indian mobile number format.");
    return "+91 " + s.slice(0, 5) + " " + s.slice(5);
  },
);
calc(
  "india",
  "Indian Currency Formatter",
  [a("Rupees", 1234567.89)],
  "Format an amount using Indian digit grouping and the rupee symbol.",
  (v) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(n(v)),
);
const small = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
function inWords(x) {
  if (x < 20) return small[x];
  if (x < 100)
    return (
      [
        "",
        "",
        "twenty",
        "thirty",
        "forty",
        "fifty",
        "sixty",
        "seventy",
        "eighty",
        "ninety",
      ][Math.floor(x / 10)] + (x % 10 ? " " + small[x % 10] : "")
    );
  for (const [value, label] of [
    [1e7, "crore"],
    [1e5, "lakh"],
    [1000, "thousand"],
    [100, "hundred"],
  ])
    if (x >= value)
      return (
        inWords(Math.floor(x / value)) +
        " " +
        label +
        (x % value ? " " + inWords(x % value) : "")
      );
}
calc(
  "india",
  "Rupees to Words",
  [a("Rupees", 1234567.89)],
  "Write up to 999,999,999 rupees in Indian English with paise rounded to two decimal places.",
  (v) => {
    const total = Math.round(number(v.a, "Rupees", 0, 999999999) * 100),
      rupees = Math.floor(total / 100),
      paise = total % 100;
    return `${inWords(rupees)} rupees${paise ? " and " + inWords(paise) + " paise" : ""} only`;
  },
);
calc(
  "india",
  "Financial Year Calculator",
  [f("start", "Date", "2026-10-22", "date")],
  "Indian financial years run from April 1 through March 31.",
  (v) => {
    const d = date(v.start),
      start = d.getUTCFullYear() - (d.getUTCMonth() < 3 ? 1 : 0);
    return `FY ${start}–${String(start + 1).slice(-2)} (1 April ${start} to 31 March ${start + 1})`;
  },
);

// Practical tools with user-supplied rates and physical assumptions.
const everyday = [
  [
    "Fuel Cost Calculator",
    [
      a("Distance (km)", 300),
      b("Mileage (km/liter)", 15),
      c("Fuel price per liter", 100),
    ],
    "Fuel cost = distance ÷ mileage × fuel price.",
    (v) => (number(v.a, "Distance", 0) / p(v, "b")) * number(v.c, "Price", 0),
  ],
  [
    "Mileage Calculator",
    [a("Distance traveled (km)", 300), b("Fuel used (liters)", 20)],
    "Mileage = distance ÷ fuel used, in km/liter.",
    (v) => number(v.a, "Distance", 0) / p(v, "b"),
  ],
  [
    "Travel Time Calculator",
    [a("Distance (km)", 300), b("Average speed (km/h)", 60)],
    "Travel time in hours = distance ÷ average speed. Stops are not included.",
    (v) => number(v.a, "Distance", 0) / p(v, "b"),
  ],
  [
    "EV Charging Cost",
    [
      a("Battery capacity (kWh)", 50),
      b("Charge added (%)", 80),
      c("Price per kWh", 8),
      f("d", "Charging efficiency (%)", 90),
    ],
    "Battery capacity × charge fraction ÷ efficiency × electricity price.",
    (v) =>
      ((p(v) * percent(v, "b")) / number(v.d, "Efficiency", 0.1, 100)) *
      number(v.c, "Price", 0),
  ],
  [
    "EV Range Calculator",
    [a("Usable energy (kWh)", 50), b("Consumption (kWh/100 km)", 15)],
    "Estimated range = energy ÷ consumption × 100. Actual conditions vary.",
    (v) => (number(v.a, "Energy", 0) / p(v, "b")) * 100,
  ],
  [
    "Appliance Electricity Cost",
    [
      a("Power (watts)", 1000),
      b("Hours per day", 4),
      c("Days", 30),
      f("d", "Price per kWh", 8),
    ],
    "watts ÷ 1000 × hours/day × days × price/kWh. Excludes fixed charges, taxes and tariff slabs.",
    (v) =>
      (number(v.a, "Watts", 0) / 1000) *
      number(v.b, "Hours", 0, 24) *
      number(v.c, "Days", 0) *
      number(v.d, "Price", 0),
  ],
  [
    "Watt to Unit Calculator",
    [a("Power (watts)", 1000), b("Hours", 5)],
    "Energy in kWh (units) = watts × hours ÷ 1000.",
    (v) => (number(v.a, "Watts", 0) * number(v.b, "Hours", 0)) / 1000,
  ],
  [
    "Battery Backup Calculator",
    [
      a("Battery voltage", 12),
      b("Capacity (Ah)", 150),
      c("Load (watts)", 300),
      f("d", "Usable efficiency (%)", 80),
    ],
    "Estimated runtime in hours = voltage × Ah × usable efficiency ÷ load. Battery chemistry and discharge limits affect actual results.",
    (v) => (p(v) * p(v, "b") * percent(v, "d")) / 100 / p(v, "c"),
  ],
  [
    "Water Tank Volume",
    [
      a("Length (meters)", 2),
      b("Width (meters)", 1.5),
      c("Height (meters)", 1),
    ],
    "Rectangular tank volume in liters = length × width × height × 1000.",
    (v) => p(v) * p(v, "b") * p(v, "c") * 1000,
  ],
  [
    "Concrete Volume Calculator",
    [
      a("Length (meters)", 5),
      b("Width (meters)", 3),
      c("Depth (meters)", 0.15),
    ],
    "Concrete volume in cubic meters = length × width × depth. Does not specify structural mix design.",
    (v) => p(v) * p(v, "b") * p(v, "c"),
  ],
  [
    "Tile Calculator",
    [a("Floor area (m²)", 20), b("Tile area (m²)", 0.36), c("Wastage (%)", 10)],
    "Tiles needed = ceiling(floor area ÷ tile area × (1 + wastage)).",
    (v) =>
      Math.ceil((p(v) / p(v, "b")) * (1 + number(v.c, "Wastage", 0) / 100)),
  ],
  [
    "Paint Calculator",
    [
      a("Paintable area (m²)", 100),
      b("Coverage per liter (m²)", 10),
      c("Coats", 2),
    ],
    "Liters = area × coats ÷ coverage. Use the paint manufacturer’s coverage rate.",
    (v) => (p(v) * I(v, "c", 1, 20)) / p(v, "b"),
  ],
  [
    "Flooring Cost",
    [
      a("Floor area", 100),
      b("Material cost per unit area", 50),
      c("Installation cost per unit area", 20),
    ],
    "Total = area × (material rate + installation rate). Use consistent area units.",
    (v) =>
      p(v) * (number(v.b, "Material cost", 0) + number(v.c, "Installation", 0)),
  ],
  [
    "Recipe Scaling Calculator",
    [
      a("Original servings", 4),
      b("Desired servings", 10),
      c("Original ingredient quantity", 200),
    ],
    "Scaled quantity = ingredient amount × desired servings ÷ original servings. Keep the same ingredient unit.",
    (v) => (number(v.c, "Quantity", 0) * p(v, "b")) / p(v),
  ],
  [
    "Restaurant Bill Splitter",
    [a("Bill total", 2000), b("Tip (%)", 10), c("People", 4)],
    "Per-person share = bill × (1 + tip ÷ 100) ÷ people.",
    (v) =>
      (number(v.a, "Bill", 0) * (1 + number(v.b, "Tip", 0) / 100)) /
      I(v, "c", 1, 10000),
  ],
  [
    "Tip Calculator India",
    [a("Bill", 2000), b("Tip (%)", 10)],
    "Optional tip = bill × tip percentage ÷ 100. No service charge or tax is inferred.",
    (v) => (number(v.a, "Bill", 0) * number(v.b, "Tip", 0)) / 100,
  ],
  [
    "Event Seating Calculator",
    [a("Guests", 125), b("Seats per table", 8)],
    "Tables needed = ceiling(guests ÷ seats per table).",
    (v) => Math.ceil(I(v) / I(v, "b", 1)),
  ],
  [
    "Trip Budget Calculator",
    [
      a("Daily costs", 2500),
      b("Travel days", 5),
      c("Transport + other fixed costs", 5000),
    ],
    "Trip budget = daily spending × days + fixed costs.",
    (v) =>
      number(v.a, "Daily cost", 0) * I(v, "b", 1) +
      number(v.c, "Fixed cost", 0),
  ],
  [
    "Hosting Cost Calculator",
    [
      a("Monthly hosting", 1000),
      b("Annual domain renewal", 1000),
      c("Other annual costs", 2000),
    ],
    "Annual running cost = monthly hosting × 12 + domain renewal + other annual costs.",
    (v) =>
      number(v.a, "Hosting", 0) * 12 +
      number(v.b, "Domain", 0) +
      number(v.c, "Other", 0),
  ],
  [
    "Website Bandwidth Calculator",
    [a("Page size (MB)", 2), b("Monthly page views", 100000)],
    "Estimated monthly bandwidth (decimal GB) = MB per page × page views ÷ 1000. Excludes caching and non-page traffic.",
    (v) => (number(v.a, "Size", 0) * number(v.b, "Views", 0)) / 1000,
  ],
  [
    "Image Compression Savings Calculator",
    [a("Original bytes", 1000000), b("Compressed bytes", 250000)],
    "Savings percentage = (original − compressed) ÷ original × 100. Negative values indicate a larger output.",
    (v) => ((p(v) - number(v.b, "Compressed bytes", 0)) / p(v)) * 100,
  ],
  [
    "Pace Calculator",
    [a("Duration (minutes)", 30), b("Distance (km)", 5)],
    "Pace = time ÷ distance, expressed in minutes per kilometer.",
    (v) => `${round(number(v.a, "Duration", 0) / p(v, "b"))} min/km`,
  ],
];
for (const [name, fields, formula, fn] of everyday)
  calc("home", name, fields, formula, fn);

// Design values and accessible color math.
function rgb(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex))
    throw Error("Use a six-digit HEX color, for example #245C46.");
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
calc(
  "design",
  "HEX to RGB",
  [f("color", "HEX color", "#245c46", "color")],
  "Convert a six-digit hexadecimal color to red, green and blue values.",
  (v) => `rgb(${rgb(v.color).join(", ")})`,
);
calc(
  "design",
  "RGB to HEX",
  [a("Red (0–255)", 36), b("Green (0–255)", 92), c("Blue (0–255)", 70)],
  "Convert three integer channels into a six-digit HEX color.",
  (v) =>
    "#" +
    ["a", "b", "c"]
      .map((k) => integer(v[k], k, 0, 255).toString(16).padStart(2, "0"))
      .join(""),
);
calc(
  "design",
  "HEX to HSL",
  [f("color", "HEX color", "#245c46", "color")],
  "Convert RGB channels to hue, saturation and lightness.",
  (v) => {
    const [r, g, b] = rgb(v.color).map((x) => x / 255),
      max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      d = max - min,
      l = (max + min) / 2;
    let h = 0,
      s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h =
        60 *
        (max === r
          ? ((g - b) / d) % 6
          : max === g
            ? (b - r) / d + 2
            : (r - g) / d + 4);
    }
    return `hsl(${round((h + 360) % 360)}, ${round(s * 100)}%, ${round(l * 100)}%)`;
  },
);
calc(
  "design",
  "HSL to HEX",
  [a("Hue (degrees)", 156), b("Saturation (%)", 44), c("Lightness (%)", 25)],
  "Convert hue, saturation and lightness into HEX RGB.",
  (v) => {
    const h = ((n(v) % 360) + 360) % 360,
      s = percent(v, "b") / 100,
      l = percent(v, "c") / 100,
      c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = l - c / 2;
    const channels =
      h < 60
        ? [c, x, 0]
        : h < 120
          ? [x, c, 0]
          : h < 180
            ? [0, c, x]
            : h < 240
              ? [0, x, c]
              : h < 300
                ? [x, 0, c]
                : [c, 0, x];
    return (
      "#" +
      channels
        .map((x) =>
          Math.round((x + m) * 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  },
);
calc(
  "design",
  "Color Contrast Calculator",
  [
    f("foreground", "Text color", "#245c46", "color"),
    f("background", "Background color", "#ffffff", "color"),
  ],
  "WCAG relative luminance contrast. AA normal text requires 4.5:1; large text requires 3:1.",
  (v) => {
    const lum = (s) => {
      const [r, g, b] = rgb(s)
        .map((c) => c / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = lum(v.foreground),
      b = lum(v.background),
      r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return {
      ratio: round(r),
      "AA normal": r >= 4.5 ? "Pass" : "Fail",
      "AA large": r >= 3 ? "Pass" : "Fail",
      "AAA normal": r >= 7 ? "Pass" : "Fail",
    };
  },
);
calc(
  "design",
  "CSS Gradient Generator",
  [
    f("first", "First color", "#245c46", "color"),
    f("second", "Second color", "#d8eedc", "color"),
    a("Angle (degrees)", 135),
  ],
  "Create a two-color linear-gradient CSS declaration.",
  (v) => {
    rgb(v.first);
    rgb(v.second);
    return `background: linear-gradient(${n(v)}deg, ${v.first}, ${v.second});`;
  },
  { extension: "css" },
);
calc(
  "design",
  "Border Radius Generator",
  [
    a("Top left (px)", 16),
    b("Top right (px)", 16),
    c("Bottom right (px)", 16),
    f("d", "Bottom left (px)", 16),
  ],
  "CSS order: top-left, top-right, bottom-right, bottom-left.",
  (v) =>
    `border-radius: ${["a", "b", "c", "d"].map((k) => number(v[k], k, 0) + "px").join(" ")};`,
  { extension: "css" },
);
calc(
  "design",
  "Box Shadow Generator",
  [
    a("Horizontal offset (px)", 0),
    b("Vertical offset (px)", 8),
    c("Blur (px)", 24),
    f("d", "Spread (px)", 0),
    f("color", "Shadow color", "#245c46", "color"),
  ],
  "Create a single box-shadow with offsets, nonnegative blur, spread and color.",
  (v) => {
    rgb(v.color);
    return `box-shadow: ${n(v)}px ${n(v, "b")}px ${number(v.c, "Blur", 0)}px ${n(v, "d")}px ${v.color};`;
  },
  { extension: "css" },
);
calc(
  "design",
  "Aspect Ratio Calculator",
  [a("Width", 1920), b("Height", 1080)],
  "Simplify whole-number width and height to the smallest ratio.",
  (v) => {
    const w = I(v, "a", 1),
      h = I(v, "b", 1),
      g = gcd(w, h);
    return `${w / g}:${h / g}`;
  },
);
calc(
  "design",
  "Golden Ratio Calculator",
  [a("Shorter length", 100)],
  "Longer length = shorter × φ; φ = (1 + √5) ÷ 2.",
  (v) => (p(v) * (1 + Math.sqrt(5))) / 2,
);
calc(
  "design",
  "CSS Clamp Generator",
  [
    a("Minimum font (px)", 16),
    b("Maximum font (px)", 32),
    c("Minimum viewport (px)", 320),
    f("d", "Maximum viewport (px)", 1280),
  ],
  "Build a fluid font-size between two viewport widths. Output is in px and vw.",
  (v) => {
    const min = p(v),
      max = p(v, "b"),
      start = p(v, "c"),
      end = p(v, "d");
    if (max < min || end <= start)
      throw Error(
        "Maximum font must be at least minimum; maximum viewport must be greater than minimum.",
      );
    const slope = (max - min) / (end - start),
      intercept = min - slope * start;
    return `font-size: clamp(${min}px, calc(${round(intercept)}px + ${round(slope * 100)}vw), ${max}px);`;
  },
  { extension: "css" },
);

import {extendCatalog, aliases} from './extended.mjs';
import {extendTemplates} from './templates.mjs';
extendCatalog({register, field});
extendTemplates({register, field});
register('pdf','Crop PDF',[
 field('unit','Margin units','percent','select',['percent','pt']),
 ...['left','top','right','bottom'].map(key=>field(key,`${key[0].toUpperCase()+key.slice(1)} margin`, '5')),
 field('scope','Apply crop to','all','select',['all','selected']),
 field('pages','Selected pages (e.g. 1,3-5)','1','text'),
],'Change PDF page boundaries locally. Hidden content remains in the file; cropping is not secure redaction.',null,{id:'crop-pdf',kind:'pdf',mode:'crop',accept:'.pdf,application/pdf',multiple:false,description:'Crop all or selected PDF pages with percentage or point margins. Preview and download locally.'});
aliases['pdf-crop']='crop-pdf';
register('image','Batch Image Resize',[
 field('a','Width (px)','800'),field('b','Height (px; 0 maintains each image aspect ratio)','0'),
 field('format','Output format','image/webp','select',['image/webp','image/jpeg','image/png']),field('quality','Quality','0.9'),
],'Resize up to 100 images locally in automatic batches of 50, then download a ZIP. Free without an account.',null,{id:'batch-image-resize',kind:'image',mode:'resize',multiple:true,accept:'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',description:'Resize 50–100 images for free. Add more files, process automatic batches of 50 and download a ZIP.'});
export {aliases};
export function resolveTool(id) { return getTool(id) || getTool(aliases[id]); }

// Valid, reproducible examples for decoder tools.
getTool('base64-decoder').fields[0].value='SGVsbG8gd29ybGQ=';
getTool('ascii-to-text').fields[0].value='72 101 108 108 111';

import {extendBatchTwo} from './batch-two.mjs';
extendBatchTwo({register,field,aliases});

import {extendReferenceTools} from './reference-tools.mjs';
import {extendReferenceFiles} from './reference-files.mjs';
import {extendReferenceBrowser} from './reference-browser.mjs';
import {extendReferenceExtras} from './reference-extras.mjs';
for (const extend of [extendReferenceTools,extendReferenceFiles,extendReferenceBrowser,extendReferenceExtras]) extend({register,field,aliases});
// Keep the existing URL and aliases while making the single-output behavior explicit.
Object.assign(getTool('pdf-split'),{name:'Extract PDF Pages',description:'Extract selected pages into one PDF. Selected pages become one file, not separate PDFs.'});
getTool('pdf-reorder').fields.find(f=>f.key==='pages').value='';
getTool('pdf-rotate').description='Rotate all PDF pages clockwise by the selected angle.';
getTool('image-resize').fields.find(f=>f.key==='b').label='Height (px)';
getTool('base64-to-image').fields[0].value='';
getTool('images-to-pdf').fields.push(field('orientation','Page orientation','portrait','select',['portrait','landscape']),field('fit','Image fit','contain','select',['contain','cover']));
register('pdf','PDF Editor',[],'Add text, highlights, drawings and visual whiteouts; reorder, rotate or remove pages. Original page text is retained. A whiteout only covers content visually and is not secure redaction.',null,{id:'pdf-editor',kind:'pdf-editor',accept:'application/pdf,.pdf',description:'Edit a PDF in your browser: add text, highlight, draw, reorder, rotate and download.'});
register('office','Spreadsheet Editor',[],'A local workbook with supported formulas, cell styles, multiple sheets, sorting, filtering and keyboard shortcuts. Import XLSX, CSV, TSV or workspace JSON. Export XLSX, CSV, TSV, HTML or JSON. Supports 10,000 rows, 256 columns per sheet and 100,000 populated/styled cells; advanced Excel features are not retained.',null,{id:'spreadsheet-editor',kind:'spreadsheet-editor',accept:'.xlsx,.csv,.tsv,.json',description:'Create and edit spreadsheets with formulas, formatting, sheet tabs and familiar keyboard shortcuts. Import and export supported XLSX workbooks.'});
register('finance','Invoice Converter',[],'Extract selectable PDF text or use local English/Hindi OCR for photos and scanned pages. Review and edit extracted text, then export HTML, Excel, CSV, TXT, JSON, PDF or photos. Outputs contain reviewed text lines; original invoice layout and financial columns are not reconstructed. OCR models download on first use.',null,{id:'invoice-converter',kind:'invoice-importer',accept:'application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp',description:'Convert an existing invoice PDF or photo into editable text and export HTML, Excel, CSV, PDF, photos and ZIP.'});
Object.assign(aliases,{'edit-pdf':'pdf-editor','excel-editor':'spreadsheet-editor','invoice-to-excel':'invoice-converter','invoice-to-html':'invoice-converter'});
for (const [alias,target] of Object.entries(aliases)) {
  if (!getTool(target)) throw Error(`Unknown alias target ${alias}: ${target}`);
  if (getTool(alias) && alias!==target) throw Error(`Alias shadows tool ${alias}`);
}

for (const [alias, target] of Object.entries(aliases)) {
  const tool = getTool(target);
  if (tool) tool.searchTerms = ((tool.searchTerms || '') + ' ' + alias.replaceAll('-', ' ')).trim();
}
const metadataRemover=getTool('pdf-metadata-remover');
metadataRemover.description='Remove original document-level PDF metadata by copying pages into a fresh file. Embedded content is not redacted or scrubbed; the writer may add fresh technical metadata.';
metadataRemover.formula=metadataRemover.description;

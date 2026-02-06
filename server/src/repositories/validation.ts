import { Connection } from "vscode-languageserver";
import { PhpRunner } from "../analyzer/php";
import { BoundedCache } from "../support/cache";

export interface ValidationRule {
  name: string;
  description: string;
  hasParameters: boolean;
}

/**
 * Repository for Laravel validation rules.
 * Provides built-in rules and custom rule classes.
 */
export class ValidationRepository {
  private rules: ValidationRule[] = [];
  private rulesByName: Map<string, ValidationRule> = new Map();
  private cache: BoundedCache<ValidationRule[]>;

  constructor(
    private php: PhpRunner,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<ValidationRule[]>(10, 30 * 60 * 1000);
  }

  async load(): Promise<void> {
    const cached = this.cache.get("validation");
    if (cached) {
      this.setRules(cached);
      return;
    }

    try {
      // Built-in Laravel validation rules
      const builtIn = this.getBuiltInRules();

      // Try to find custom Rule classes
      let customRules: ValidationRule[] = [];
      try {
        const phpCode = `
$rules = [];
$rulesPath = app_path('Rules');
if (is_dir($rulesPath)) {
    $iterator = new \\RecursiveIteratorIterator(
        new \\RecursiveDirectoryIterator($rulesPath, \\FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if ($file->getExtension() !== 'php') continue;
        $content = file_get_contents($file->getRealPath());
        if (preg_match('/class\\s+(\\w+)/', $content, $m)) {
            $rules[] = $m[1];
        }
    }
}
echo json_encode($rules);
`;
        const output = await this.php.runInLaravel(phpCode);
        const ruleNames: string[] = JSON.parse(output);
        customRules = ruleNames.map((name) => ({
          name: `App\\Rules\\${name}`,
          description: `Custom rule: ${name}`,
          hasParameters: false,
        }));
      } catch {
        // Custom rules are optional
      }

      const allRules = [...builtIn, ...customRules];
      this.setRules(allRules);
      this.cache.set("validation", allRules);
      this.connection.console.log(
        `[Validation] Loaded ${allRules.length} rules (${builtIn.length} built-in, ${customRules.length} custom)`
      );
    } catch (e) {
      this.connection.console.log(`[Validation] Failed to load: ${e}`);
      // Fallback to built-in rules only
      const builtIn = this.getBuiltInRules();
      this.setRules(builtIn);
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  findByName(name: string): ValidationRule | undefined {
    return this.rulesByName.get(name);
  }

  search(query: string): ValidationRule[] {
    if (!query) return this.rules;
    const lower = query.toLowerCase();
    return this.rules.filter((r) => r.name.toLowerCase().includes(lower));
  }

  getAll(): ValidationRule[] {
    return this.rules;
  }

  count(): number {
    return this.rules.length;
  }

  private setRules(rules: ValidationRule[]): void {
    this.rules = rules;
    this.rulesByName.clear();
    for (const rule of rules) {
      this.rulesByName.set(rule.name, rule);
    }
  }

  private getBuiltInRules(): ValidationRule[] {
    return [
      { name: "accepted", description: "The field must be yes, on, 1, or true", hasParameters: false },
      { name: "accepted_if", description: "The field must be accepted when another field equals a value", hasParameters: true },
      { name: "active_url", description: "The field must have a valid A or AAAA record", hasParameters: false },
      { name: "after", description: "The field must be a date after the given date", hasParameters: true },
      { name: "after_or_equal", description: "The field must be a date after or equal to the given date", hasParameters: true },
      { name: "alpha", description: "The field must be entirely alphabetic characters", hasParameters: false },
      { name: "alpha_dash", description: "The field may have alpha-numeric, dashes, and underscores", hasParameters: false },
      { name: "alpha_num", description: "The field must be entirely alpha-numeric characters", hasParameters: false },
      { name: "array", description: "The field must be a PHP array", hasParameters: false },
      { name: "ascii", description: "The field must be entirely ASCII characters", hasParameters: false },
      { name: "bail", description: "Stop running validation rules after the first failure", hasParameters: false },
      { name: "before", description: "The field must be a date before the given date", hasParameters: true },
      { name: "before_or_equal", description: "The field must be a date before or equal to the given date", hasParameters: true },
      { name: "between", description: "The field must have a size between min and max", hasParameters: true },
      { name: "boolean", description: "The field must be able to be cast as a boolean", hasParameters: false },
      { name: "confirmed", description: "The field must have a matching field of {field}_confirmation", hasParameters: false },
      { name: "contains", description: "The field must contain the given value", hasParameters: true },
      { name: "current_password", description: "The field must match the authenticated user's password", hasParameters: false },
      { name: "date", description: "The field must be a valid date", hasParameters: false },
      { name: "date_equals", description: "The field must be equal to the given date", hasParameters: true },
      { name: "date_format", description: "The field must match the given date format", hasParameters: true },
      { name: "decimal", description: "The field must be a decimal number with specified precision", hasParameters: true },
      { name: "declined", description: "The field must be no, off, 0, or false", hasParameters: false },
      { name: "different", description: "The field must have a different value than another field", hasParameters: true },
      { name: "digits", description: "The field must be numeric and have an exact length", hasParameters: true },
      { name: "digits_between", description: "The field must be numeric between the given length", hasParameters: true },
      { name: "dimensions", description: "The image must meet dimension constraints", hasParameters: true },
      { name: "distinct", description: "The field must not have any duplicate values in an array", hasParameters: false },
      { name: "doesnt_end_with", description: "The field must not end with one of the given values", hasParameters: true },
      { name: "doesnt_start_with", description: "The field must not start with one of the given values", hasParameters: true },
      { name: "email", description: "The field must be a valid email address", hasParameters: false },
      { name: "ends_with", description: "The field must end with one of the given values", hasParameters: true },
      { name: "enum", description: "The field must contain a valid enum value", hasParameters: true },
      { name: "exclude", description: "The field will be excluded from the request data", hasParameters: false },
      { name: "exclude_if", description: "The field will be excluded if another field has a given value", hasParameters: true },
      { name: "exclude_unless", description: "The field will be excluded unless another field has a given value", hasParameters: true },
      { name: "exists", description: "The field must exist in the database table", hasParameters: true },
      { name: "extensions", description: "The file must have one of the given extensions", hasParameters: true },
      { name: "file", description: "The field must be a successfully uploaded file", hasParameters: false },
      { name: "filled", description: "The field must not be empty when it is present", hasParameters: false },
      { name: "gt", description: "The field must be greater than another field", hasParameters: true },
      { name: "gte", description: "The field must be greater than or equal to another field", hasParameters: true },
      { name: "hex_color", description: "The field must contain a valid hex color value", hasParameters: false },
      { name: "image", description: "The file must be an image (jpg, jpeg, png, bmp, gif, svg, webp)", hasParameters: false },
      { name: "in", description: "The field must be included in the given list of values", hasParameters: true },
      { name: "in_array", description: "The field must exist in another field's values", hasParameters: true },
      { name: "integer", description: "The field must be an integer", hasParameters: false },
      { name: "ip", description: "The field must be an IP address", hasParameters: false },
      { name: "ipv4", description: "The field must be an IPv4 address", hasParameters: false },
      { name: "ipv6", description: "The field must be an IPv6 address", hasParameters: false },
      { name: "json", description: "The field must be a valid JSON string", hasParameters: false },
      { name: "list", description: "The field must be an array that is a list", hasParameters: false },
      { name: "lowercase", description: "The field must be lowercase", hasParameters: false },
      { name: "lt", description: "The field must be less than another field", hasParameters: true },
      { name: "lte", description: "The field must be less than or equal to another field", hasParameters: true },
      { name: "mac_address", description: "The field must be a MAC address", hasParameters: false },
      { name: "max", description: "The field must be less than or equal to a maximum value", hasParameters: true },
      { name: "max_digits", description: "The integer must have a maximum number of digits", hasParameters: true },
      { name: "mimetypes", description: "The file must match one of the given MIME types", hasParameters: true },
      { name: "mimes", description: "The file must have a MIME type corresponding to one of the listed extensions", hasParameters: true },
      { name: "min", description: "The field must have a minimum value", hasParameters: true },
      { name: "min_digits", description: "The integer must have a minimum number of digits", hasParameters: true },
      { name: "missing", description: "The field must not be present in the input data", hasParameters: false },
      { name: "missing_if", description: "The field must not be present when another field equals a value", hasParameters: true },
      { name: "missing_unless", description: "The field must not be present unless another field equals a value", hasParameters: true },
      { name: "multiple_of", description: "The field must be a multiple of the given value", hasParameters: true },
      { name: "not_in", description: "The field must not be included in the given list of values", hasParameters: true },
      { name: "not_regex", description: "The field must not match the given regular expression", hasParameters: true },
      { name: "nullable", description: "The field may be null", hasParameters: false },
      { name: "numeric", description: "The field must be numeric", hasParameters: false },
      { name: "password", description: "The field must match the authenticated user's password", hasParameters: false },
      { name: "present", description: "The field must be present in the input data", hasParameters: false },
      { name: "present_if", description: "The field must be present when another field equals a value", hasParameters: true },
      { name: "present_unless", description: "The field must be present unless another field equals a value", hasParameters: true },
      { name: "prohibited", description: "The field must be empty or not present", hasParameters: false },
      { name: "prohibited_if", description: "The field must be empty when another field equals a value", hasParameters: true },
      { name: "prohibited_unless", description: "The field must be empty unless another field equals a value", hasParameters: true },
      { name: "prohibits", description: "If the field is present, no other specified fields can be present", hasParameters: true },
      { name: "regex", description: "The field must match the given regular expression", hasParameters: true },
      { name: "required", description: "The field must be present in the input data and not empty", hasParameters: false },
      { name: "required_array_keys", description: "The field must contain all of the given keys", hasParameters: true },
      { name: "required_if", description: "The field is required when another field equals a value", hasParameters: true },
      { name: "required_if_accepted", description: "The field is required when another field is accepted", hasParameters: true },
      { name: "required_unless", description: "The field is required unless another field equals a value", hasParameters: true },
      { name: "required_with", description: "The field is required when any of the specified fields are present", hasParameters: true },
      { name: "required_with_all", description: "The field is required when all of the specified fields are present", hasParameters: true },
      { name: "required_without", description: "The field is required when any of the specified fields are not present", hasParameters: true },
      { name: "required_without_all", description: "The field is required when all of the specified fields are not present", hasParameters: true },
      { name: "same", description: "The field must match another field", hasParameters: true },
      { name: "size", description: "The field must have a size matching the given value", hasParameters: true },
      { name: "sometimes", description: "Only validate the field if it is present", hasParameters: false },
      { name: "starts_with", description: "The field must start with one of the given values", hasParameters: true },
      { name: "string", description: "The field must be a string", hasParameters: false },
      { name: "timezone", description: "The field must be a valid timezone identifier", hasParameters: false },
      { name: "unique", description: "The field must be unique in the database table", hasParameters: true },
      { name: "uppercase", description: "The field must be uppercase", hasParameters: false },
      { name: "url", description: "The field must be a valid URL", hasParameters: false },
      { name: "ulid", description: "The field must be a valid ULID", hasParameters: false },
      { name: "uuid", description: "The field must be a valid UUID", hasParameters: false },
    ];
  }
}

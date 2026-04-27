import checker from "license-checker";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

checker.init(
  {
    start: join(__dirname, ".."),
    production: true,
    customFormat: {
      name: "",
      version: "",
      licenses: "",
      repository: "",
      licenseText: "",
    },
  },
  (err, packages) => {
    if (err) {
      console.error("Error generating licenses:", err);
      process.exit(1);
    }

    const licenses = Object.entries(packages)
      .map(([key, pkg]) => ({
        id: key,
        name: pkg.name || key.split("@")[0],
        version: pkg.version || "",
        license: Array.isArray(pkg.licenses)
          ? pkg.licenses.join(", ")
          : pkg.licenses || "UNKNOWN",
        url: pkg.repository || "",
        text: pkg.licenseText || "No license text available.",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    writeFileSync(
      join(__dirname, "..", "public", "licenses.json"),
      JSON.stringify(licenses, null, 2),
    );
    console.log(`Generated licenses.json with ${licenses.length} packages`);
  },
);

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectEditorialContent,
  parseKdpEditorialDraftV1,
} from "../src/lib/kdp/importer/kdp-editorial-draft-v1.ts";

function getFileArgument(args: string[]) {
  const inline = args.find((argument) => argument.startsWith("--file="));

  if (inline) {
    return inline.slice("--file=".length);
  }

  const fileIndex = args.indexOf("--file");

  return fileIndex >= 0 ? args[fileIndex + 1] : undefined;
}

const fileArgument = getFileArgument(process.argv.slice(2));

if (!fileArgument) {
  console.error(
    'Uso: npm.cmd run kdp:editorial-validate -- --file="percorso/manoscritto.txt"',
  );
  process.exitCode = 1;
} else {
  const rawText = readFileSync(resolve(fileArgument), "utf8");
  const project = parseKdpEditorialDraftV1(rawText);
  const expectedLines = project.source.contentText
    .split("\n")
    .filter((line) => line.trim());
  const actualLines = collectEditorialContent(project).flatMap((value) =>
    value.split("\n"),
  );
  const maxLineCount = Math.max(expectedLines.length, actualLines.length);
  let firstMismatch = -1;

  for (let index = 0; index < maxLineCount; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      firstMismatch = index;
      break;
    }
  }

  const blocks = project.sections.flatMap((section) => [
    ...section.blocks,
    ...section.subsections.flatMap((subsection) => subsection.blocks),
  ]);
  const blockTypes = blocks.reduce<Record<string, number>>((counts, block) => {
    counts[block.type] = (counts[block.type] ?? 0) + 1;

    return counts;
  }, {});

  console.log(
    JSON.stringify(
      {
        structure: {
          title: project.title,
          subtitle: project.subtitle,
          sections: project.sections.map((section) => ({
            kind: section.kind,
            title: section.title,
            subsections: section.subsections.map((subsection) => ({
              kind: subsection.kind,
              number: subsection.number ?? null,
              title: subsection.title,
            })),
          })),
        },
        counts: {
          ...project.summary,
          blockTypes,
          sectionCount: project.sections.length,
        },
        integrity: {
          firstMismatch,
          matches: firstMismatch === -1,
          parsedLineCount: actualLines.length,
          sourceLineCount: expectedLines.length,
        },
        warnings: project.warnings,
        errors: project.errors,
      },
      null,
      2,
    ),
  );

  if (firstMismatch !== -1 || project.errors.length > 0) {
    process.exitCode = 1;
  }
}

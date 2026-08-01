#!/usr/bin/env bash
# ============================================================================
# 语法校验：每次修改 index.html 后必须运行！
# 作用：提取 <script> 内的内联 JS，用 `node --check` 校验语法。
#       若遗漏（如本次 food 行漏逗号导致整段脚本解析失败、所有模块丢失），
#       此脚本能立刻发现，避免 Bug 流入页面。
# 依赖：node（本项目使用 /Users/nini/.workbuddy/binaries/node/versions/22.22.2/bin/node）
# 用法：bash tests/check_syntax.sh
# ============================================================================
set -e
NODE=/Users/nini/.workbuddy/binaries/node/versions/22.22.2/bin/node
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HTML="$ROOT/index.html"
TMP="$(mktemp /tmp/app_extract.XXXXXX.js)"
trap 'rm -f "$TMP"' EXIT

"$NODE" -e '
const fs=require("fs");
const html=fs.readFileSync(process.argv[1],"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m){ console.error("未找到 <script> 块"); process.exit(1); }
fs.writeFileSync(process.argv[2], m[1]);
' "$HTML" "$TMP"

if "$NODE" --check "$TMP" 2>/tmp/err.txt; then
  echo "✅ 语法校验通过"
  exit 0
else
  echo "❌ 语法校验失败："
  grep -nE "SyntaxError|Unexpected|Unterminated|line [0-9]" /tmp/err.txt | head
  exit 1
fi

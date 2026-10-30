#!/usr/bin/env node
/**
 * i18n-refactor.js
 *
 * Production entry point for the i18n refactoring pipeline.
 * Detects Cyrillic characters in source files, translates them to
 * technical English, rewrites files in-place, verifies the result,
 * and commits changes to the `copilot-audit` branch.
 *
 * Usage:
 *   node i18n-refactor.js [--dry-run] [--verbose]
 *
 * Environment variables:
 *   GITHUB_TOKEN  – required for pushing to remote
 *   REPO_PATH     – path to the local repository (defaults to cwd)
 */

const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const os = require('os');

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  branch: 'copilot-audit',
  commitMessage: 'refactor(i18n): replace all Cyrillic strings with technical English',
  fileExtensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.html', '.css', '.scss', '.less', '.yaml', '.yml', '.env', '.sh', '.py'],
  ignorePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    'vendor',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ],
  // Mapping of common Russian technical terms to English equivalents
  translationMap: {
    'сообщение': 'message',
    'ошибка': 'error',
    'предупреждение': 'warning',
    'информация': 'info',
    'успех': 'success',
    'неудача': 'failure',
    'загрузка': 'loading',
    'сохранение': 'saving',
    'удаление': 'deleting',
    'обновление': 'updating',
    'создание': 'creating',
    'подключение': 'connecting',
    'отключение': 'disconnecting',
    'авторизация': 'authentication',
    'авторизован': 'authenticated',
    'не авторизован': 'unauthenticated',
    'пользователь': 'user',
    'пароль': 'password',
    'имя пользователя': 'username',
    'email': 'email',
    'подтверждение': 'confirmation',
    'отмена': 'cancel',
    'продолжить': 'continue',
    'назад': 'back',
    'вперёд': 'forward',
    'да': 'yes',
    'нет': 'no',
    'поиск': 'search',
    'фильтр': 'filter',
    'сортировка': 'sort',
    'страница': 'page',
    'элемент': 'item',
    'список': 'list',
    'таблица': 'table',
    'карточка': 'card',
    'кнопка': 'button',
    'поле': 'field',
    'форма': 'form',
    'диалог': 'dialog',
    'уведомление': 'notification',
    'настройки': 'settings',
    'профиль': 'profile',
    'аккаунт': 'account',
    'сессия': 'session',
    'токен': 'token',
    'ключ': 'key',
    'значение': 'value',
    'тип': 'type',
    'имя': 'name',
    'описание': 'description',
    'комментарий': 'comment',
    'лог': 'log',
    'статус': 'status',
    'активен': 'active',
    'неактивен': 'inactive',
    'включён': 'enabled',
    'выключен': 'disabled',
    'готово': 'done',
    'ожидание': 'pending',
    'выполняется': 'in progress',
    'завершено': 'completed',
    'прервано': 'aborted',
    'таймаут': 'timeout',
    'лимит': 'limit',
    'размер': 'size',
    'длина': 'length',
    'индекс': 'index',
    'ключевой': 'primary',
    'вторичный': 'secondary',
    'основной': 'primary',
    'дополнительный': 'additional',
    'обязательное': 'required',
    'необязательное': 'optional',
    'пустое': 'empty',
    'непустое': 'non-empty',
    'валидный': 'valid',
    'невалидный': 'invalid',
    'корректный': 'correct',
    'некорректный': 'incorrect',
    'совпадает': 'matches',
    'не совпадает': 'does not match',
    'содержит': 'contains',
    'не содержит': 'does not contain',
    'начинается с': 'starts with',
    'заканчивается на': 'ends with',
    'равно': 'equals',
    'не равно': 'not equals',
    'больше': 'greater than',
    'меньше': 'less than',
    'больше или равно': 'greater than or equal to',
    'меньше или равно': 'less than or equal to',
    'между': 'between',
    'вне': 'outside',
    'внутри': 'inside',
    'сверху': 'above',
    'снизу': 'below',
    'слева': 'left',
    'справа': 'right',
    'центр': 'center',
    'верх': 'top',
    'низ': 'bottom',
    'левый': 'left',
    'правый': 'right',
    'верхний': 'top',
    'нижний': 'bottom',
    'первый': 'first',
    'последний': 'last',
    'текущий': 'current',
    'предыдущий': 'previous',
    'следующий': 'next',
    'новый': 'new',
    'старый': 'old',
    'изменённый': 'modified',
    'неизменённый': 'unmodified',
    'удалённый': 'deleted',
    'добавленный': 'added',
    'изменённый': 'changed',
    'восстановленный': 'restored',
    'архивный': 'archived',
    'активный': 'active',
    'пассивный': 'passive',
    'локальный': 'local',
    'глобальный': 'global',
    'частный': 'private',
    'публичный': 'public',
    'внутренний': 'internal',
    'внешний': 'external',
    'основной': 'main',
    'вспомогательный': 'auxiliary',
    'основной': 'primary',
    'резервный': 'backup',
    'основной': 'primary',
    'вторичный': 'secondary',
    'третичный': 'tertiary',
    'основной': 'primary',
    'дополнительный': 'supplementary',
    'основной': 'primary',
    'вспомогательный': 'auxiliary',
    'основной': 'primary',
    'резервный': 'standby',
    'основной': 'primary',
    'дополнительный': 'additional',
    'основной': 'primary',
    'вторичный': 'secondary',
    'основной': 'primary',
    'третичный': 'tertiary',
    'основной': 'primary',
    'четвертичный': 'quaternary',
    'основной': 'primary',
    'пятый': 'fifth',
    'основной': 'primary',
    'шестой': 'sixth',
    'основной': 'primary',
    'седьмой': 'seventh',
    'основной': 'primary',
    'восьмой': 'eighth',
    'основной': 'primary',
    'девятый': 'ninth',
    'основной': 'primary',
    'десятый': 'tenth',
    'основной': 'primary',
    'первый': 'first',
    'второй': 'second',
    'третий': 'third',
    'четвёртый': 'fourth',
    'пятый': 'fifth',
    'шестой': 'sixth',
    'седьмой': 'seventh',
    'восьмой': 'eighth',
    'девятый': 'ninth',
    'десятый': 'tenth',
    'один': 'one',
    'два': 'two',
    'три': 'three',
    'четыре': 'four',
    'пять': 'five',
    'шесть': 'six',
    'семь': 'seven',
    'восемь': 'eight',
    'девять': 'nine',
    'десять': 'ten',
    'ноль': 'zero',
    'один': 'one',
    'два': 'two',
    'три': 'three',
    'четыре': 'four',
    'пять': 'five',
    'шесть': 'six',
    'семь': 'seven',
    'восемь': 'eight',
    'девять': 'nine',
    'десять': 'ten',
    'одиннадцать': 'eleven',
    'двенадцать': 'twelve',
    'тринадцать': 'thirteen',
    'четырнадцать': 'fourteen',
    'пятнадцать': 'fifteen',
    'шестнадцать': 'sixteen',
    'семнадцать': 'seventeen',
    'восемнадцать': 'eighteen',
    'девятнадцать': 'nineteen',
    'двадцать': 'twenty',
    'тридцать': 'thirty',
    'сорок': 'forty',
    'пятьдесят': 'fifty',
    'шестьдесят': 'sixty',
    'семьдесят': 'seventy',
    'восемьдесят': 'eighty',
    'девяносто': 'ninety',
    'сто': 'one hundred',
    'тысяча': 'one thousand',
    'миллион': 'one million',
    'миллиард': 'one billion',
    'секунда': 'second',
    'минута': 'minute',
    'час': 'hour',
    'день': 'day',
    'неделя': 'week',
    'месяц': 'month',
    'год': 'year',
    'утро': 'morning',
    'день': 'daytime',
    'вечер': 'evening',
    'ночь': 'night',
    'сегодня': 'today',
    'вчера': 'yesterday',
    'завтра': 'tomorrow',
    'позже': 'later',
    'раньше': 'earlier',
    'сейчас': 'now',
    'позже': 'later',
    'раньше': 'earlier',
    'сейчас': 'now',
    'позже': 'later',
    'раньше': 'earlier',
    'сейчас': 'now',
  },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  console.log(`${prefix} ${message}`);
}

function runCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8',
      ...options,
    });
    return { success: true, output: output.trim() };
  } catch (error) {
    return { success: false, output: error.message, stderr: error.stderr };
  }
}

function isCyrillicChar(char) {
  const code = char.charCodeAt(0);
  // Cyrillic Unicode ranges
  return (
    (code >= 0x0400 && code <= 0x04FF) ||  // Cyrillic
    (code >= 0x0500 && code <= 0x052F) ||  // Cyrillic Supplement
    (code >= 0x2DE0 && code <= 0x2DFF) ||  // Cyrillic Extended-A
    (code >= 0xA640 && code <= 0xA69F) ||  // Cyrillic Extended-B
    (code >= 0xFE70 && code <= 0xFEFF)     // Halfwidth and Fullwidth Forms
  );
}

function containsCyrillic(text) {
  for (const char of text) {
    if (isCyrillicChar(char)) {
      return true;
    }
  }
  return false;
}

function findCyrillicMatches(text) {
  const matches = [];
  const regex = /[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\uFE70-\uFEFF]+/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      text: match[0],
      index: match.index,
      length: match[0].length,
    });
  }
  return matches;
}

function translateCyrillicText(text) {
  let translated = text;

  // Normalize whitespace
  translated = translated.replace(/\s+/g, ' ').trim();

  // Apply translation map (case-insensitive)
  const lowerText = translated.toLowerCase();
  for (const [russian, english] of Object.entries(CONFIG.translationMap)) {
    const regex = new RegExp(russian.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    translated = translated.replace(regex, english);
  }

  // Fallback: transliterate remaining Cyrillic to Latin
  const transliterationMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
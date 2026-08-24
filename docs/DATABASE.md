# Структура базы данных

СУБД — файловая SQLite (`data/teamhub.db`), режим WAL. Полная схема — `src/db/schema.sql`.

## users — сотрудники и администраторы

| Поле | Тип | Описание |
|---|---|---|
| id | INTEGER PK | |
| first_name, last_name | TEXT | имя и фамилия |
| login | TEXT UNIQUE | логин для входа |
| password_hash | TEXT | bcrypt-хэш пароля |
| position | TEXT | должность |
| birth_day, birth_month | INTEGER | дата рождения без года (п. 6.3 ТЗ) |
| role | TEXT | `admin` \| `employee` |
| is_active | INTEGER | 0/1 — деактивированные не могут войти |
| created_at | TEXT | дата создания |

## tasks — задачи

| Поле | Тип | Описание |
|---|---|---|
| id | INTEGER PK | |
| title, description | TEXT | название и описание |
| due_date | TEXT | срок выполнения (локальное время, как введено пользователем) |
| status | TEXT | `new` \| `in_progress` \| `done` \| `overdue` |
| creator_id | INTEGER FK → users | постановщик |
| deadline_reminder_sent_at | TEXT | когда в последний раз отправлено напоминание о сроке |
| created_at, updated_at | TEXT | |

## task_assignees — исполнители задач (многие-ко-многим)

| Поле | Тип |
|---|---|
| task_id | INTEGER FK → tasks |
| user_id | INTEGER FK → users |

## documents — документы

| Поле | Тип | Описание |
|---|---|---|
| id | INTEGER PK | |
| stored_name | TEXT | имя файла на диске (`uploads/`) |
| original_name | TEXT | исходное имя файла |
| mime_type, size | | |
| uploader_id | INTEGER FK → users | кто загрузил |
| recipient_id | INTEGER FK → users, NULL | получатель; NULL = «все сотрудники» |
| uploaded_at | TEXT | |

## messages — сообщения чата

| Поле | Тип | Описание |
|---|---|---|
| id | INTEGER PK | |
| sender_id | INTEGER FK → users, NULL | NULL — системное сообщение (напоминание) |
| recipient_id | INTEGER FK → users, NULL | NULL — общий канал «для всех» |
| content | TEXT | текст сообщения |
| is_llm_generated | INTEGER | признак генерации через LLM (п. 5.6.4) |
| llm_provider | TEXT | использованный поставщик (`template`/`gemini`/`ollama`) |
| created_at | TEXT | |

Личное системное напоминание (sender_id = NULL, recipient_id = конкретный сотрудник) не
относится ни к одной паре «сотрудник-сотрудник» и выбирается отдельным запросом
(вкладка «Уведомления» в интерфейсе чата).

## llm_logs — журнал обращений к LLM (п. 5.6.4)

| Поле | Тип | Описание |
|---|---|---|
| id | INTEGER PK | |
| timestamp | TEXT | дата и время обращения |
| request_type | TEXT | `birthday_greeting` \| `task_reminder` \| `assistant_message` |
| initiator_id | INTEGER FK → users, NULL | NULL — инициировано планировщиком напоминаний |
| provider | TEXT | использованный поставщик |
| result | TEXT | `success` \| `error` \| `timeout` |
| duration_ms | INTEGER | длительность обращения |
| error_message | TEXT | текст ошибки (при наличии) |

## settings — настройки, изменяемые администратором без перезапуска (п. 5.6.7)

Таблица ключ-значение: `birthday_reminder_enabled`, `deadline_reminder_enabled`,
`daily_check_time`, `llm_tone_instruction` и служебные ключи планировщика
(даты последней отправки — для защиты от повторной отправки в течение суток).

Параметры поставщика LLM (адрес API, модель, ключ доступа) в базе данных не хранятся —
они находятся только в файле `config/config.json` на сервере (п. 4.6, 5.6.4, 5.6.5 ТЗ).

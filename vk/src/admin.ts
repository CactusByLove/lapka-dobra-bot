import { IDEA_STATUS_LABEL, ROLE_LABEL } from "./levels.js";
import { notifyVolunteers } from "./notify.js";
import {
  adminUserCard,
  adminUserDetails,
  applicationText,
  approvalText,
  ideaCard,
} from "./texts.js";
import {
  deleteUserInline,
  ideaModerationInline,
  pawInline,
  applicationInline,
  userCardInline,
  usersNavKeyboard,
  adminKeyboard,
  mentorKeyboard,
  menuKeyboard,
} from "./keyboards.js";
import {
  allUsers,
  awardPaws,
  decidePawRequest,
  getIdea,
  getPawRequest,
  getUser,
  listIdeas,
  pendingPawRequests,
  removeUser,
  setIdeaStatus,
  stats,
  updateUser,
} from "./storage.js";
import { deletePrevious, replaceScreen, send, sendScreen } from "./vk.js";
import type { IdeaStatus } from "./types.js";

export interface AdminEvent {
  userId: number;
  peerId: number;
  payload: Record<string, unknown>;
  isCreator: boolean;
  flags: { admin: boolean; mentor: boolean };
}

const USERS_PER_PAGE = 8;

function statsText(userId: number): string {
  const summary = stats();
  const head =
    userId === getUser(userId)?.tgId && getUser(userId)?.role === "creator"
      ? "👑 Главная лапка\n\n"
      : "";
  return `${head}📊 Сводка проекта

👥 Пользователи: ${summary.total}
✅ В команде: ${summary.approved}
⏳ На проверке: ${summary.pending}
💡 Идей: ${summary.ideas} (в работе — ${summary.ideasInWork})
🐾 Начислений на проверке: ${summary.pawsPending}
🚫 Заблокированы: ${summary.blocked}`;
}

function usersPage(page: number) {
  const users = [...allUsers()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const pages = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  return {
    users: users.slice(
      current * USERS_PER_PAGE,
      (current + 1) * USERS_PER_PAGE,
    ),
    page: current,
    pages,
    total: users.length,
  };
}

function idOf(payload: Record<string, unknown>): number {
  const value = payload.id;
  return typeof value === "number" ? value : Number(value ?? 0);
}

function textOf(payload: Record<string, unknown>): string {
  const value = payload.id;
  return typeof value === "string" ? value : String(value ?? "");
}

async function listApplications(peerId: number): Promise<void> {
  const pending = allUsers().filter((user) => user.status === "pending");
  if (pending.length === 0) {
    await sendScreen(peerId, "admin", "Новых заявок нет — всё разобрано 🐾", adminKeyboard());
    return;
  }
  await deletePrevious(peerId);
  for (const user of pending) {
    await send(peerId, applicationText(user), {
      keyboard: applicationInline(user.tgId),
    });
  }
  await replaceScreen(
    peerId,
    `📥 Заявки: ${pending.length} на проверке. Решай кнопкой под карточкой.`,
    { keyboard: adminKeyboard() },
  );
}

async function showIdeaQueue(peerId: number): Promise<void> {
  const ideas = listIdeas().filter((idea) => idea.status === "review");
  if (ideas.length === 0) {
    await sendScreen(peerId, "admin", "Идей на разборе нет 🐾", adminKeyboard());
    return;
  }
  await deletePrevious(peerId);
  for (const idea of ideas) {
    await send(peerId, ideaCard(idea), {
      keyboard: ideaModerationInline(idea.id),
    });
  }
  await replaceScreen(
    peerId,
    `💡 Идей на модерации: ${ideas.length}. Публикует или отклоняет Главная лапка.`,
    { keyboard: adminKeyboard() },
  );
}

async function listPaws(peerId: number): Promise<void> {
  const requests = pendingPawRequests();
  if (requests.length === 0) {
    await sendScreen(peerId, "admin", "Начислений на проверке нет 🐾", adminKeyboard());
    return;
  }
  await deletePrevious(peerId);
  for (const request of requests) {
    await send(
      peerId,
      `🐾 ${request.userName}: +${request.amount}\n${request.reason}`,
      { keyboard: pawInline(request.id) },
    );
  }
  await replaceScreen(peerId, `🐾 Начислений на проверке: ${requests.length}.`, {
    keyboard: adminKeyboard(),
  });
}

async function listUsers(peerId: number, page: number): Promise<void> {
  const data = usersPage(page);
  await replaceScreen(
    peerId,
    `👥 Пользователи\nВсего: ${data.total} · страница ${data.page + 1}/${data.pages}`,
    { keyboard: usersNavKeyboard(data.page, data.pages) },
  );
  for (const user of data.users) {
    await send(peerId, adminUserCard(user), {
      keyboard: userCardInline(
        user.tgId,
        user.blocked,
        user.role !== "creator" && user.tgId !== peerId,
      ),
    });
  }
}

export async function handleAdminEvent(event: AdminEvent): Promise<boolean> {
  const { userId, peerId, payload, isCreator, flags } = event;
  const cmd = typeof payload.c === "string" ? payload.c : "";
  if (!cmd) return false;

  const deny = async (text: string): Promise<void> => {
    await send(peerId, text);
  };

  if (cmd === "admin" || cmd.startsWith("admin:")) {
    if (!flags.admin) {
      await deny("Недостаточно прав: админка доступна Главной лапке и координаторам.");
      return true;
    }
    if (cmd === "admin" || cmd === "admin:stats") {
      await sendScreen(peerId, "admin", statsText(userId), adminKeyboard());
      return true;
    }
    if (cmd === "admin:apps") {
      await listApplications(peerId);
      return true;
    }
    if (cmd === "admin:ideas") {
      await showIdeaQueue(peerId);
      return true;
    }
    if (cmd === "admin:paws") {
      await listPaws(peerId);
      return true;
    }
    if (cmd === "admin:users" || /^admin:users:\d+$/.test(cmd)) {
      const page = cmd === "admin:users" ? 0 : Number(cmd.split(":")[2] ?? 0);
      await listUsers(peerId, page);
      return true;
    }
  }

  if (cmd.startsWith("app:")) {
    if (!flags.admin) {
      await deny("Решение по заявкам принимает Главная лапка или координатор.");
      return true;
    }
    const action = cmd.split(":")[1];
    const target = getUser(idOf(payload));
    if (!target) {
      await deny("Заявка не найдена.");
      return true;
    }
    if (action === "approve") {
      updateUser(target.tgId, { status: "approved" });
      const award = awardPaws(target.tgId, 10, "Входной практикум");
      await send(target.tgId, approvalText(target, award.granted), {
        keyboard: menuKeyboard(false, target.role === "mentor"),
      }).catch(() => undefined);
      await replaceScreen(
        peerId,
        `✅ ${target.nickname} принят(а) в команду. Начислено: +${award.granted} 🐾`,
        { keyboard: adminKeyboard() },
      );
      return true;
    }
    if (action === "rework") {
      updateUser(target.tgId, { status: "need_rework" });
      await send(
        target.tgId,
        "Нужно доработать заявку: напиши координатору, что поправить — и продолжим.",
      ).catch(() => undefined);
      await replaceScreen(peerId, `🔄 По заявке ${target.nickname} запрошена доработка.`, {
        keyboard: adminKeyboard(),
      });
      return true;
    }
    updateUser(target.tgId, { status: "rejected" });
    await send(
      target.tgId,
      "Заявка отклонена. Если это ошибка или хочешь уточнить — напиши координатору.",
    ).catch(() => undefined);
    await replaceScreen(peerId, `❌ Заявка ${target.nickname} отклонена.`, {
      keyboard: adminKeyboard(),
    });
    return true;
  }

  if (cmd.startsWith("idea:st:")) {
    if (!isCreator) {
      await deny("Решение по идеям принимает Главная лапка.");
      return true;
    }
    const status = cmd.split(":")[2] as IdeaStatus;
    const ideaId = textOf(payload);
    const idea = getIdea(ideaId);
    if (!idea) {
      await deny("Идея не найдена.");
      return true;
    }
    setIdeaStatus(ideaId, status);
    const label = IDEA_STATUS_LABEL[status] ?? status;
    await send(idea.authorTgId, `💡 Твоя идея «${idea.title}»: ${label}.`, {
      keyboard: menuKeyboard(false, false),
    }).catch(() => undefined);
    if (status === "published") {
      await notifyVolunteers(ideaCard(idea));
    }
    await replaceScreen(peerId, `💡 Идея «${idea.title}»: ${label}.`, {
      keyboard: adminKeyboard(),
    });
    return true;
  }

  if (cmd.startsWith("pawreq:")) {
    if (!flags.admin && !flags.mentor) {
      await deny("Подтверждать лапки может наставник или координатор.");
      return true;
    }
    const approve = cmd.split(":")[1] === "yes";
    const request = getPawRequest(textOf(payload));
    if (!request || request.status !== "pending") {
      await deny("Запрос уже обработан.");
      return true;
    }
    if (!approve) {
      decidePawRequest(request.id, "rejected");
      await send(
        request.tgId,
        `❌ Начисление отклонено: ${request.reason}.`,
      ).catch(() => undefined);
      await replaceScreen(peerId, `❌ Отклонено: ${request.userName} — ${request.reason}.`, {
        keyboard: adminKeyboard(),
      });
      return true;
    }
    const award = awardPaws(request.tgId, request.amount, request.reason);
    if (!award.ok) {
      await deny("Недельный лимит 100 лапок исчерпан.");
      return true;
    }
    decidePawRequest(request.id, "approved");
    await send(
      request.tgId,
      `🐾 Начислено +${award.granted} лапок: ${request.reason}.`,
    ).catch(() => undefined);
    await replaceScreen(
      peerId,
      `✅ ${request.userName}: +${award.granted} 🐾 (${request.reason}).`,
      { keyboard: adminKeyboard() },
    );
    return true;
  }

  if (cmd.startsWith("user:")) {
    if (!flags.admin) {
      await deny("Управление пользователями доступно Главной лапке и координаторам.");
      return true;
    }
    const action = cmd.split(":")[1];
    const target = getUser(idOf(payload));
    if (!target) {
      await deny("Пользователь не найден.");
      return true;
    }
    if (action === "view") {
      await replaceScreen(peerId, adminUserDetails(target), {
        keyboard: userCardInline(
          target.tgId,
          target.blocked,
          target.role !== "creator" && target.tgId !== peerId,
        ),
      });
      return true;
    }
    if (action === "block" || action === "unblock") {
      const blocked = action === "block";
        if (target.tgId === userId || (target.role as string) === "creator") {
        await deny("Нельзя заблокировать создателя или себя.");
        return true;
      }
      updateUser(target.tgId, { blocked });
      await replaceScreen(
        peerId,
        `${blocked ? "🚫" : "✅"} ${target.nickname} ${blocked ? "заблокирован(а)" : "разблокирован(а)"}.`,
        {
          keyboard: userCardInline(
            target.tgId,
            blocked,
            target.role !== "creator" && target.tgId !== peerId,
          ),
        },
      );
      return true;
    }
    if (action === "del") {
      await replaceScreen(
        peerId,
        `🗑 Удалить ${target.nickname} (${target.tgId})? Действие необратимо.`,
        { keyboard: deleteUserInline(target.tgId) },
      );
      return true;
    }
    if (action === "delok") {
        if (target.tgId === userId || (target.role as string) === "creator") {
        await deny("Создателя удалить нельзя.");
        return true;
      }
      removeUser(target.tgId);
      await replaceScreen(peerId, `🗑 Пользователь ${target.nickname} удалён.`, {
        keyboard: adminKeyboard(),
      });
      return true;
    }
  }

  if (cmd === "mentor" || cmd.startsWith("mentor:")) {
    if (!flags.admin && !flags.mentor) {
      await deny("Панель наставника доступна наставникам и выше.");
      return true;
    }
    if (cmd === "mentor" || cmd === "mentor:menu") {
      await sendScreen(
        peerId,
        "mentor",
        "🦸 Панель наставника\n\nЗдесь новые заявки и начисления на проверке. Решение по заявкам принимает Главная лапка или координатор.",
        mentorKeyboard(),
      );
      return true;
    }
    if (cmd === "mentor:apps") {
      const pending = allUsers().filter((user) => user.status === "pending");
      if (pending.length === 0) {
        await sendScreen(peerId, "mentor", "Новых заявок нет — всё разобрано 🐾", mentorKeyboard());
        return true;
      }
      await deletePrevious(peerId);
      for (const user of pending) {
        await send(
          peerId,
          `${applicationText(user)}\n\nРешение принимает Главная лапка или координатор.`,
        );
      }
      await replaceScreen(peerId, `📥 Заявки: ${pending.length}.`, {
        keyboard: mentorKeyboard(),
      });
      return true;
    }
    if (cmd === "mentor:paws") {
      const requests = pendingPawRequests();
      if (requests.length === 0) {
        await sendScreen(peerId, "mentor", "Начислений на проверке нет 🐾", mentorKeyboard());
        return true;
      }
      await deletePrevious(peerId);
      for (const request of requests) {
        await send(
          peerId,
          `🐾 ${request.userName}: +${request.amount}\n${request.reason}`,
          { keyboard: pawInline(request.id) },
        );
      }
      await replaceScreen(peerId, `🐾 Начислений на проверке: ${requests.length}.`, {
        keyboard: mentorKeyboard(),
      });
      return true;
    }
  }

  return false;
}

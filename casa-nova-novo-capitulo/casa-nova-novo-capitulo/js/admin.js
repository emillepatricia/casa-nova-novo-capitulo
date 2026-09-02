import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { APP_CONFIG, CATEGORIES, INITIAL_ITEMS, firebaseConfig } from "./config.js";

const state = {
  app: null,
  db: null,
  auth: null,
  user: null,
  items: [],
  reservations: [],
  filter: "",
  unsubscribers: [],
};

const els = {
  loginPanel: document.getElementById("loginPanel"),
  dashboardPanel: document.getElementById("dashboardPanel"),
  loginForm: document.getElementById("loginForm"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  loginFeedback: document.getElementById("loginFeedback"),
  logoutButton: document.getElementById("logoutButton"),
  adminStatus: document.getElementById("adminStatus"),
  seedButton: document.getElementById("seedButton"),
  exportButton: document.getElementById("exportButton"),
  adminSearchInput: document.getElementById("adminSearchInput"),
  reservationRows: document.getElementById("reservationRows"),
  adminEmptyState: document.getElementById("adminEmptyState"),
  availableList: document.getElementById("availableList"),
  adminTotal: document.getElementById("adminTotal"),
  adminReserved: document.getElementById("adminReserved"),
  adminAvailable: document.getElementById("adminAvailable"),
  adminReceived: document.getElementById("adminReceived"),
};

function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig &&
      firebaseConfig.apiKey &&
      firebaseConfig.apiKey !== "COLE_AQUI" &&
      firebaseConfig.projectId &&
      firebaseConfig.projectId !== "COLE_AQUI"
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCategoryLabel(categoryId) {
  return CATEGORIES.find((category) => category.id === categoryId)?.label || categoryId;
}

function formatDate(value) {
  if (!value) return "-";

  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function assertConfigured() {
  if (!hasFirebaseConfig()) {
    throw new Error("Configure o Firebase no arquivo js/config.js antes de usar a área dos donos.");
  }
}

function initFirebase() {
  assertConfigured();
  state.app = initializeApp(firebaseConfig);
  state.db = getFirestore(state.app);
  state.auth = getAuth(state.app);
}

function showLogin() {
  els.loginPanel.hidden = false;
  els.dashboardPanel.hidden = true;
  els.logoutButton.hidden = true;
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
}

function showDashboard() {
  els.loginPanel.hidden = true;
  els.dashboardPanel.hidden = false;
  els.logoutButton.hidden = false;
}

async function login(event) {
  event.preventDefault();

  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;

  if (!email || !password) {
    els.loginFeedback.textContent = "Informe e-mail e senha para entrar.";
    return;
  }

  els.loginFeedback.textContent = "Entrando...";

  try {
    await signInWithEmailAndPassword(state.auth, email, password);
    els.loginFeedback.textContent = "";
  } catch (error) {
    els.loginFeedback.textContent = "Não foi possível entrar. Confira e-mail, senha e regras do Firebase.";
  }
}

function listenData() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];

  const itemsQuery = query(collection(state.db, "items"), orderBy("order"));
  const reservationsQuery = query(collection(state.db, "reservations"), orderBy("createdAt", "desc"));

  const unsubscribeItems = onSnapshot(
    itemsQuery,
    (snapshot) => {
      state.items = snapshot.docs.map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
      renderDashboard();
    },
    () => {
      els.adminStatus.textContent = "Erro ao ler itens. Verifique se seu e-mail está liberado nas regras.";
    }
  );

  const unsubscribeReservations = onSnapshot(
    reservationsQuery,
    (snapshot) => {
      state.reservations = snapshot.docs.map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
      renderDashboard();
    },
    () => {
      els.adminStatus.textContent = "Erro ao ler reservas. Verifique as regras do Firestore.";
    }
  );

  state.unsubscribers.push(unsubscribeItems, unsubscribeReservations);
}

function getReservationRows() {
  const normalizedFilter = normalizeText(state.filter);

  return state.reservations.filter((reservation) => {
    const item = state.items.find((currentItem) => currentItem.id === reservation.itemId);
    const searchable = normalizeText(
      `${reservation.itemName} ${reservation.name} ${reservation.phone} ${reservation.message} ${getCategoryLabel(reservation.category)} ${item?.title || ""}`
    );

    return !normalizedFilter || searchable.includes(normalizedFilter);
  });
}

function renderStats() {
  const total = state.items.length;
  const reserved = state.items.filter((item) => item.status === "reserved").length;
  const available = total - reserved;
  const received = state.reservations.filter((reservation) => reservation.received).length;

  els.adminTotal.textContent = String(total);
  els.adminReserved.textContent = String(reserved);
  els.adminAvailable.textContent = String(available);
  els.adminReceived.textContent = String(received);

  if (total === 0) {
    els.adminStatus.textContent = "Nenhum item cadastrado ainda. Clique em “Carregar lista inicial”.";
  } else {
    els.adminStatus.textContent = `Conectado como ${state.user?.email || "dono"}. Dados atualizados automaticamente.`;
  }
}

function renderReservationsTable() {
  const rows = getReservationRows();
  els.adminEmptyState.hidden = rows.length > 0;

  els.reservationRows.innerHTML = rows.map((reservation) => {
    const item = state.items.find((currentItem) => currentItem.id === reservation.itemId);
    const status = reservation.received ? "Recebido" : "Reservado";
    const category = getCategoryLabel(reservation.category || item?.category);

    return `
      <tr>
        <td><strong>${escapeHtml(reservation.itemName || item?.title || reservation.itemId)}</strong><br><small>${escapeHtml(formatDate(reservation.createdAt))}</small></td>
        <td>${escapeHtml(category)}</td>
        <td>${escapeHtml(reservation.name)}</td>
        <td>${escapeHtml(reservation.phone || "-")}</td>
        <td>${escapeHtml(reservation.message || "-")}</td>
        <td><span class="badge ${reservation.received ? "available" : "reserved"}">${status}</span></td>
        <td>
          <div class="row-actions">
            <button class="mini-button" type="button" data-toggle-received="${reservation.id}">
              ${reservation.received ? "Desmarcar" : "Marcar recebido"}
            </button>
            <button class="mini-button" type="button" data-release="${reservation.id}">Liberar item</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderAvailableList() {
  const availableItems = state.items
    .filter((item) => item.status !== "reserved")
    .sort((a, b) => (a.order || 999) - (b.order || 999));

  if (availableItems.length === 0) {
    els.availableList.innerHTML = `<span class="available-chip">Todos os itens foram escolhidos 🎉</span>`;
    return;
  }

  els.availableList.innerHTML = availableItems.map((item) => `
    <span class="available-chip">${escapeHtml(item.icon || "🎁")} ${escapeHtml(item.title)}</span>
  `).join("");
}

function renderDashboard() {
  renderStats();
  renderReservationsTable();
  renderAvailableList();
}

async function seedItems() {
  if (!confirm("Carregar a lista inicial? Itens já existentes serão preservados e não terão status alterado.")) return;

  els.seedButton.disabled = true;
  els.adminStatus.textContent = "Carregando lista inicial...";

  try {
    const batch = writeBatch(state.db);

    for (const item of INITIAL_ITEMS) {
      const itemRef = doc(state.db, "items", item.id);
      const snapshot = await getDoc(itemRef);

      if (snapshot.exists()) {
        batch.set(
          itemRef,
          {
            title: item.title,
            category: item.category,
            description: item.description,
            icon: item.icon,
            order: item.order,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        batch.set(itemRef, {
          ...item,
          status: "available",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
    els.adminStatus.textContent = "Lista inicial carregada com sucesso.";
  } catch (error) {
    els.adminStatus.textContent = "Não foi possível carregar a lista. Confira se seu e-mail está liberado nas regras.";
  } finally {
    els.seedButton.disabled = false;
  }
}

async function toggleReceived(reservationId) {
  const reservation = state.reservations.find((currentReservation) => currentReservation.id === reservationId);
  if (!reservation) return;

  await updateDoc(doc(state.db, "reservations", reservationId), {
    received: !reservation.received,
    updatedAt: serverTimestamp(),
  });
}

async function releaseItem(reservationId) {
  const reservation = state.reservations.find((currentReservation) => currentReservation.id === reservationId);
  if (!reservation) return;

  const confirmed = confirm(`Liberar o item "${reservation.itemName}"? A escolha de ${reservation.name} será removida.`);
  if (!confirmed) return;

  const batch = writeBatch(state.db);
  const itemRef = doc(state.db, "items", reservation.itemId);
  const reservationRef = doc(state.db, "reservations", reservationId);

  batch.delete(reservationRef);
  batch.update(itemRef, {
    status: "available",
    reservedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

function exportCsv() {
  const header = ["Item", "Categoria", "Escolhido por", "WhatsApp", "Mensagem", "Status", "Data"];
  const rows = state.reservations.map((reservation) => [
    reservation.itemName || "",
    getCategoryLabel(reservation.category),
    reservation.name || "",
    reservation.phone || "",
    reservation.message || "",
    reservation.received ? "Recebido" : "Reservado",
    formatDate(reservation.createdAt),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lista-casa-nova.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function attachEvents() {
  els.loginForm.addEventListener("submit", login);
  els.logoutButton.addEventListener("click", () => signOut(state.auth));
  els.seedButton.addEventListener("click", seedItems);
  els.exportButton.addEventListener("click", exportCsv);
  els.adminSearchInput.addEventListener("input", (event) => {
    state.filter = event.target.value;
    renderReservationsTable();
  });

  els.reservationRows.addEventListener("click", async (event) => {
    const receivedButton = event.target.closest("[data-toggle-received]");
    const releaseButton = event.target.closest("[data-release]");

    try {
      if (receivedButton) {
        await toggleReceived(receivedButton.dataset.toggleReceived);
      }

      if (releaseButton) {
        await releaseItem(releaseButton.dataset.release);
      }
    } catch (error) {
      els.adminStatus.textContent = "Não foi possível executar a ação. Verifique conexão e permissões.";
    }
  });
}

try {
  initFirebase();
  attachEvents();

  onAuthStateChanged(state.auth, (user) => {
    state.user = user;

    if (user) {
      showDashboard();
      listenData();
    } else {
      showLogin();
    }
  });
} catch (error) {
  els.loginFeedback.textContent = error.message;
  els.loginForm.querySelector("button").disabled = true;
}

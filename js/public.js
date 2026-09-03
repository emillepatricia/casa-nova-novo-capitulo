import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { APP_CONFIG, CATEGORIES, INITIAL_ITEMS, firebaseConfig } from "./config.js";

const root = document;
const state = {
  db: null,
  configured: false,
  items: [],
  selectedCategory: "todos",
  search: "",
  selectedItem: null,
};

const els = {
  publicTitle: root.getElementById("publicTitle"),
  publicSubtitle: root.getElementById("publicSubtitle"),
  publicDescription: root.getElementById("publicDescription"),
  categoryTabs: root.getElementById("categoryTabs"),
  giftGrid: root.getElementById("giftGrid"),
  emptyState: root.getElementById("emptyState"),
  searchInput: root.getElementById("searchInput"),
  connectionStatus: root.getElementById("connectionStatus"),
  availableCount: root.getElementById("availableCount"),
  reservedCount: root.getElementById("reservedCount"),
  totalCount: root.getElementById("totalCount"),
  giftDialog: root.getElementById("giftDialog"),
  reservationForm: root.getElementById("reservationForm"),
  closeDialogButton: root.getElementById("closeDialogButton"),
  cancelButton: root.getElementById("cancelButton"),
  confirmButton: root.getElementById("confirmButton"),
  dialogItemTitle: root.getElementById("dialogItemTitle"),
  dialogItemDescription: root.getElementById("dialogItemDescription"),
  selectedItemId: root.getElementById("selectedItemId"),
  guestName: root.getElementById("guestName"),
  guestPhone: root.getElementById("guestPhone"),
  guestMessage: root.getElementById("guestMessage"),
  formFeedback: root.getElementById("formFeedback"),
  successDialog: root.getElementById("successDialog"),
  closeSuccessButton: root.getElementById("closeSuccessButton"),
  successOkButton: root.getElementById("successOkButton"),
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

function getCategoryLabel(categoryId) {
  return CATEGORIES.find((category) => category.id === categoryId)?.label || categoryId;
}

function getVisibleItems() {
  const normalizedSearch = normalizeText(state.search);

  return state.items.filter((item) => {
    const matchesCategory = state.selectedCategory === "todos" || item.category === state.selectedCategory;
    const searchable = normalizeText(`${item.title} ${item.description} ${getCategoryLabel(item.category)}`);
    const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });
}

function setConnectionStatus(text, type = "default") {
  els.connectionStatus.textContent = text;
  els.connectionStatus.classList.toggle("warning", type === "warning");
}

function renderCategories() {
  els.categoryTabs.innerHTML = CATEGORIES.map((category) => {
    const activeClass = category.id === state.selectedCategory ? " active" : "";
    return `
      <button class="category-tab${activeClass}" type="button" data-category="${category.id}" role="tab" aria-selected="${category.id === state.selectedCategory}">
        ${category.icon} ${category.label}
      </button>
    `;
  }).join("");
}

function renderCounters() {
  const total = state.items.length;
  const reserved = state.items.filter((item) => item.status === "reserved").length;
  const available = total - reserved;

  els.totalCount.textContent = String(total);
  els.reservedCount.textContent = String(reserved);
  els.availableCount.textContent = String(available);
}

function renderItems() {
  const visibleItems = getVisibleItems().sort((a, b) => (a.order || 999) - (b.order || 999));

  els.emptyState.hidden = visibleItems.length > 0;
  els.giftGrid.innerHTML = visibleItems.map((item) => {
    const isReserved = item.status === "reserved";
    const statusLabel = isReserved ? "Reservado" : "Disponível";
    const statusClass = isReserved ? "reserved" : "available";
    const buttonLabel = isReserved ? "Já foi escolhido" : "Quero dar esse";

    return `
      <article class="gift-card ${isReserved ? "reserved" : ""}">
        <div class="gift-visual" aria-hidden="true">${item.icon || "🎁"}</div>
        <div class="gift-content">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description || "")}</p>
          <div class="gift-meta">
            <span class="badge">${escapeHtml(getCategoryLabel(item.category))}</span>
            <span class="badge ${statusClass}">${statusLabel}</span>
          </div>
          <button class="btn ${isReserved ? "btn-ghost" : "btn-primary"}" type="button" data-reserve="${item.id}" ${isReserved ? "disabled" : ""}>
            ${buttonLabel}
          </button>
        </div>
      </article>
    `;
  }).join("");

  renderCounters();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openDialog(itemId) {
  const item = state.items.find((currentItem) => currentItem.id === itemId);

  if (!item || item.status === "reserved") return;

  state.selectedItem = item;
  els.dialogItemTitle.textContent = item.title;
  els.dialogItemDescription.textContent = item.description || "";
  els.selectedItemId.value = item.id;
  els.guestName.value = "";
  els.guestPhone.value = "";
  els.guestMessage.value = "";
  els.formFeedback.textContent = "";
  els.confirmButton.disabled = false;

  if (typeof els.giftDialog.showModal === "function") {
    els.giftDialog.showModal();
    setTimeout(() => els.guestName.focus(), 100);
  } else {
    alert("Seu navegador não suporta esta janela. Atualize o navegador ou tente novamente pelo Chrome/Safari.");
  }
}

function closeDialog() {
  els.giftDialog.close();
}

function openSuccessDialog() {
  if (typeof els.successDialog.showModal === "function") {
    els.successDialog.showModal();
  }
}

function closeSuccessDialog() {
  els.successDialog.close();
}

function getReservationPayload() {
  const name = els.guestName.value.trim().replace(/\s+/g, " ");
  const phone = els.guestPhone.value.trim();
  const message = els.guestMessage.value.trim();

  if (name.length < 2) {
    throw new Error("Digite seu nome para confirmar a escolha.");
  }

  if (phone.length > 30) {
    throw new Error("O WhatsApp informado está muito longo.");
  }

  if (message.length > 180) {
    throw new Error("A mensagem pode ter no máximo 180 caracteres.");
  }

  return { name, phone, message };
}

async function reserveSelectedItem(event) {
  event.preventDefault();

  if (!state.selectedItem) return;

  let guestData;

  try {
    guestData = getReservationPayload();
  } catch (error) {
    els.formFeedback.textContent = error.message;
    return;
  }

  els.confirmButton.disabled = true;
  els.formFeedback.textContent = "Reservando item...";

  try {
    if (!state.configured || !state.db) {
      state.items = state.items.map((item) =>
        item.id === state.selectedItem.id ? { ...item, status: "reserved" } : item
      );
      renderItems();
      closeDialog();
      openSuccessDialog();
      return;
    }

    const itemRef = doc(state.db, "items", state.selectedItem.id);
    const reservationRef = doc(state.db, "reservations", state.selectedItem.id);

    await runTransaction(state.db, async (transaction) => {
      const itemSnapshot = await transaction.get(itemRef);

      if (!itemSnapshot.exists()) {
        throw new Error("Esse item não foi encontrado. Atualize a página e tente novamente.");
      }

      const itemData = itemSnapshot.data();

      if (itemData.status === "reserved") {
        throw new Error("Esse item acabou de ser escolhido por outra pessoa. Escolha outro mimo da lista.");
      }

      const reservationData = {
        itemId: state.selectedItem.id,
        itemName: itemData.title || state.selectedItem.title,
        category: itemData.category || state.selectedItem.category,
        name: guestData.name,
        phone: guestData.phone,
        message: guestData.message,
        received: false,
        createdAt: serverTimestamp(),
      };

      transaction.update(itemRef, {
        status: "reserved",
        reservedAt: serverTimestamp(),
      });

      transaction.set(reservationRef, reservationData);
    });

    closeDialog();
    openSuccessDialog();
  } catch (error) {
    els.formFeedback.textContent = error.message || "Não foi possível reservar agora. Tente novamente.";
    els.confirmButton.disabled = false;
  }
}

function attachEvents() {
  els.categoryTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    state.selectedCategory = button.dataset.category;
    renderCategories();
    renderItems();
  });

  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderItems();
  });

  els.giftGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reserve]");
    if (!button) return;

    openDialog(button.dataset.reserve);
  });

  els.closeDialogButton.addEventListener("click", closeDialog);
  els.cancelButton.addEventListener("click", closeDialog);
  els.reservationForm.addEventListener("submit", reserveSelectedItem);
  els.closeSuccessButton.addEventListener("click", closeSuccessDialog);
  els.successOkButton.addEventListener("click", closeSuccessDialog);
}

function initText() {
  els.publicTitle.textContent = APP_CONFIG.pageTitle;
  els.publicSubtitle.textContent = APP_CONFIG.pageSubtitle;
  els.publicDescription.textContent = APP_CONFIG.description;
}

function initFirebase() {
  state.configured = hasFirebaseConfig();

  if (!state.configured) {
    state.items = INITIAL_ITEMS.map((item) => ({ ...item, status: "available" }));
    setConnectionStatus("Modo demonstração: configure o Firebase para salvar escolhas de verdade.", "warning");
    renderItems();
    return;
  }

  const app = initializeApp(firebaseConfig);
  state.db = getFirestore(app);

  const itemsQuery = query(collection(state.db, "items"), orderBy("order"));

  onSnapshot(
    itemsQuery,
    (snapshot) => {
      state.items = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));

      if (state.items.length === 0) {
        setConnectionStatus("Lista vazia. Peça aos donos para carregar a lista inicial na área de controle.", "warning");
      } else {
        setConnectionStatus("Lista atualizada automaticamente.");
      }

      renderItems();
    },
    () => {
      setConnectionStatus("Não foi possível carregar a lista. Verifique Firebase e regras do Firestore.", "warning");
      state.items = INITIAL_ITEMS.map((item) => ({ ...item, status: "available" }));
      renderItems();
    }
  );
}

initText();
renderCategories();
attachEvents();
initFirebase();

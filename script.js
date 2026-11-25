const addFriendButton = document.getElementById("addFriend");
const addExpenseButton = document.getElementById("addExpense");

const friendForm = document.getElementById("friendForm");
const friendFormElement = document.getElementById("friendFormElement");
const friendName = document.getElementById("friendName");
const cancelFriend = document.getElementById("cancelFriend");

const expenseForm = document.getElementById("expenseForm");
const expenseFormElement = document.getElementById("expenseFormElement");
const cancelExpense = document.getElementById("cancelExpense");

const expenseTitle = document.getElementById("expenseTitle");
const expenseAmount = document.getElementById("expenseAmount");
const expensePayer = document.getElementById("expensePayer");

const participantsContainer = document.getElementById("participants");
const customShares = document.getElementById("customShares");
const shareTotal = document.getElementById("shareTotal");

const splitButton = document.getElementById("splitExpense");
const splitResult = document.getElementById("splitResult");
const splitDetails = document.getElementById("splitDetails");
const splitTotal = document.getElementById("splitTotal");

const expenseList = document.getElementById("expenseList");

const currentUser = document.getElementById("currentUser");
const owedElement = document.getElementById("owed");
const oweElement = document.getElementById("owe");

let friends = [];
let expenses = [];
let calculatedShares = null;
let savedUser = "";

function loadData() {
    try {
        const savedData = JSON.parse(
            localStorage.getItem("paisaSplitData")
        );

        if (savedData) {
            friends = savedData.friends || [];
            expenses = savedData.expenses || [];
            savedUser = savedData.currentUser || "";
        }
    } catch (error) {
        console.error("Could not load saved data:", error);
    }
}

function saveData() {
    const data = {
        friends,
        expenses,
        currentUser: currentUser.value
    };

    try {
        localStorage.setItem("paisaSplitData", JSON.stringify(data));
    } catch (error) {
        console.error("Could not save data:", error);
    }
}

function openFriendForm() {
    friendForm.hidden = false;
}

function closeFriendForm() {
    friendFormElement.reset();
    friendForm.hidden = true;
}

function addFriend(event) {
    event.preventDefault();

    const name = friendName.value.trim();

    if (!name) return;

    const exists = friends.some(
        friend => friend.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
        alert("This friend already exists!");
        return;
    }

    friends.push({
        id: Date.now(),
        name
    });

    updateFriendOptions();
    updateCurrentUserOptions();
    saveData();
    closeFriendForm();
}

function updateCurrentUserOptions() {
    const selectedUser = currentUser.value;

    currentUser.innerHTML =
        '<option value="">Select yourself</option>';

    friends.forEach(friend => {
        const option = document.createElement("option");

        option.value = friend.id;
        option.textContent = friend.name;

        currentUser.appendChild(option);
    });

    currentUser.value = selectedUser;
}

function updateFriendOptions() {
    const previousPayer = expensePayer.value;

    expensePayer.innerHTML =
        '<option value="">Select payer</option>';

    participantsContainer.innerHTML = "";

    friends.forEach(friend => {
        const option = document.createElement("option");

        option.value = friend.id;
        option.textContent = friend.name;

        expensePayer.appendChild(option);

        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.value = friend.id;
        checkbox.checked = true;

        checkbox.addEventListener("change", () => {
            invalidatePreview();
            updateCustomShares();
        });

        label.append(checkbox, friend.name);
        participantsContainer.appendChild(label);
    });

    if (friends.some(friend => friend.id === Number(previousPayer))) {
        expensePayer.value = previousPayer;
    }

    updateCustomShares();
}

function openExpenseForm() {
    if (friends.length === 0) {
        alert("Add some friends first!");
        openFriendForm();
        return;
    }

    expenseForm.hidden = false;
    updateFriendOptions();
}

function closeExpenseForm() {
    expenseFormElement.reset();
    expenseForm.hidden = true;
    customShares.innerHTML = "";
    splitDetails.innerHTML = "";
    splitResult.hidden = true;
    calculatedShares = null;

    shareTotal.textContent = "Manually allocated: Rs. 0.00";
}

function invalidatePreview() {
    calculatedShares = null;
    splitResult.hidden = true;
}

function updateCustomShares() {
    customShares.innerHTML = "";

    const selectedInputs = participantsContainer.querySelectorAll(
        "input:checked"
    );

    selectedInputs.forEach(checkbox => {
        const friend = friends.find(
            friend => friend.id === Number(checkbox.value)
        );

        const row = document.createElement("div");
        row.className = "share-row";

        const name = document.createElement("span");
        name.textContent = friend.name;

        const input = document.createElement("input");

        input.type = "number";
        input.min = "0";
        input.step = "0.01";
        input.placeholder = "Auto split";
        input.dataset.friendId = friend.id;

        input.addEventListener("input", () => {
            invalidatePreview();
            updateShareTotal();
        });

        row.append(name, input);
        customShares.appendChild(row);
    });

    updateShareTotal();
}

function updateShareTotal() {
    const inputs = customShares.querySelectorAll("input");

    let total = 0;

    inputs.forEach(input => {
        if (input.value !== "") {
            total += Math.round(Number(input.value) * 100);
        }
    });

    shareTotal.textContent =
        `Manually allocated: Rs. ${(total / 100).toFixed(2)}`;
}

function calculateShares(totalAmount, inputs) {
    const shares = [];
    const emptyInputs = [];

    let allocated = 0;

    for (const input of inputs) {
        if (input.value === "") {
            emptyInputs.push(input);
            continue;
        }

        const amount = Number(input.value);

        if (!Number.isFinite(amount) || amount < 0) {
            alert("Enter valid share amounts!");
            return null;
        }

        const amountInPaisa = Math.round(amount * 100);

        allocated += amountInPaisa;

        shares.push({
            friendId: Number(input.dataset.friendId),
            amount: amountInPaisa
        });
    }

    const remaining = totalAmount - allocated;

    if (remaining < 0) {
        alert("Individual shares exceed the total expense!");
        return null;
    }

    if (emptyInputs.length === 0 && remaining !== 0) {
        alert("Individual shares must equal the total expense!");
        return null;
    }

    if (emptyInputs.length > 0) {
        const equalShare = Math.floor(remaining / emptyInputs.length);
        let remainder = remaining % emptyInputs.length;

        emptyInputs.forEach(input => {
            let amount = equalShare;

            if (remainder > 0) {
                amount++;
                remainder--;
            }

            shares.push({
                friendId: Number(input.dataset.friendId),
                amount
            });
        });
    }

    return shares;
}

function previewSplit() {
    const amount = Math.round(Number(expenseAmount.value) * 100);
    const inputs = [...customShares.querySelectorAll("input")];

    if (!expenseTitle.value.trim()) {
        alert("Enter an expense name!");
        return;
    }

    if (!amount || amount <= 0) {
        alert("Enter a valid total amount!");
        return;
    }

    if (!expensePayer.value) {
        alert("Select who paid!");
        return;
    }

    if (inputs.length === 0) {
        alert("Select at least one participant!");
        return;
    }

    const shares = calculateShares(amount, inputs);

    if (!shares) return;

    calculatedShares = shares;
    splitDetails.innerHTML = "";

    shares.forEach(share => {
        const friend = friends.find(
            friend => friend.id === share.friendId
        );

        const row = document.createElement("p");

        row.textContent =
            `${friend.name}: Rs. ${(share.amount / 100).toFixed(2)}`;

        splitDetails.appendChild(row);
    });

    splitTotal.textContent =
        `Total: Rs. ${(amount / 100).toFixed(2)}`;

    splitResult.hidden = false;
}

function saveExpense(event) {
    event.preventDefault();

    if (!calculatedShares) {
        alert("Please split the expense first!");
        return;
    }

    const amount = Math.round(Number(expenseAmount.value) * 100);

    expenses.push({
        id: Date.now(),
        title: expenseTitle.value.trim(),
        amount: amount / 100,
        payer: Number(expensePayer.value),

        shares: calculatedShares.map(share => ({
            friendId: share.friendId,
            amount: share.amount / 100
        }))
    });

    saveData();
    displayExpenses();
    updateBalances();
    closeExpenseForm();
}

function displayExpenses() {
    expenseList.innerHTML = "";

    if (expenses.length === 0) {
        expenseList.innerHTML = `
            <div class="empty-state">
                <h3>No expenses yet</h3>
                <p>Add your first expense to get started.</p>
            </div>
        `;
        return;
    }

    expenses.forEach(expense => {
        const payer = friends.find(
            friend => friend.id === expense.payer
        );

        const item = document.createElement("div");
        item.className = "expense-card";
        item.style.cursor = "pointer";

        const heading = document.createElement("div");
        heading.className = "expense-heading";

        const title = document.createElement("h3");
        title.textContent = expense.title;

        const amount = document.createElement("strong");
        amount.textContent = `Rs. ${expense.amount.toFixed(2)}`;

        heading.append(title, amount);

        const summary = document.createElement("p");
        summary.textContent =
            `Paid by ${payer?.name || "Unknown"} · ${expense.shares.length} participants`;

        const details = document.createElement("div");
        details.hidden = true;

        const breakdownTitle = document.createElement("h4");
        breakdownTitle.textContent = "Split breakdown";

        details.appendChild(breakdownTitle);

        expense.shares.forEach(share => {
            const friend = friends.find(
                friend => friend.id === share.friendId
            );

            const row = document.createElement("p");

            row.textContent =
                `${friend?.name || "Unknown"}: Rs. ${share.amount.toFixed(2)}`;

            details.appendChild(row);
        });

        const toggleText = document.createElement("p");
        toggleText.textContent = "Click to view details";

        item.append(heading, summary, toggleText, details);

        item.addEventListener("click", () => {
            details.hidden = !details.hidden;

            toggleText.textContent = details.hidden
                ? "Click to view details"
                : "Click to hide details";
        });

        expenseList.appendChild(item);
    });
}

function updateBalances() {
    const userId = Number(currentUser.value);

    if (!userId) {
        owedElement.textContent = "Rs. 0.00";
        oweElement.textContent = "Rs. 0.00";
        return;
    }

    let netBalance = 0;

    expenses.forEach(expense => {
        if (expense.payer === userId) {
            netBalance += Math.round(expense.amount * 100);
        }

        expense.shares.forEach(share => {
            if (share.friendId === userId) {
                netBalance -= Math.round(share.amount * 100);
            }
        });
    });

    const owed = Math.max(netBalance, 0);
    const owe = Math.max(-netBalance, 0);

    owedElement.textContent = `Rs. ${(owed / 100).toFixed(2)}`;
    oweElement.textContent = `Rs. ${(owe / 100).toFixed(2)}`;
}

addFriendButton.addEventListener("click", openFriendForm);
friendFormElement.addEventListener("submit", addFriend);
cancelFriend.addEventListener("click", closeFriendForm);

addExpenseButton.addEventListener("click", openExpenseForm);
cancelExpense.addEventListener("click", closeExpenseForm);

splitButton.addEventListener("click", previewSplit);
expenseFormElement.addEventListener("submit", saveExpense);

currentUser.addEventListener("change", () => {
    saveData();
    updateBalances();
});

expenseTitle.addEventListener("input", invalidatePreview);
expenseAmount.addEventListener("input", invalidatePreview);
expensePayer.addEventListener("change", invalidatePreview);

loadData();

updateFriendOptions();
updateCurrentUserOptions();

currentUser.value = savedUser;

displayExpenses();
updateBalances();
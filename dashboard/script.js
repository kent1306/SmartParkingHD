const API_BASE_URL =
    "https://a7fls5fve5.execute-api.us-east-1.amazonaws.com/dev";


async function loadParkingSpaces()
{
    try
    {
        const response =
            await fetch(`${API_BASE_URL}/parking-spaces`);

        const result = await response.json();

        const spaces = result.data || [];


        // Update summary
        const totalSpaces = spaces.length;

        const occupiedSpaces =
            spaces.filter(
                space => space.status === "occupied"
            ).length;

        const availableSpaces =
            spaces.filter(
                space => space.status === "available"
            ).length;


        document.getElementById("totalSpaces").textContent =
            totalSpaces;

        document.getElementById("occupiedSpaces").textContent =
            occupiedSpaces;

        document.getElementById("availableSpaces").textContent =
            availableSpaces;


        // Update table
        const table =
            document.getElementById("parkingTable");

        table.innerHTML = "";


        spaces.forEach(space =>
        {
            const row = document.createElement("tr");

            const plateNumber =
                space.plateNumber || "-";

            const paymentStatus =
                space.paymentStatus || "-";

            const permitType =
                space.permitType || "-";


            row.innerHTML = `
                <td>${space.slotID}</td>

                <td class="status-${space.status}">
                    ${space.status}
                </td>

                <td>${plateNumber}</td>

                <td class="payment-${paymentStatus}">
                    ${paymentStatus}
                </td>

                <td>${permitType}</td>
            `;


            table.appendChild(row);
        });
    }

    catch (error)
    {
        console.error(
            "Failed to load parking spaces:",
            error
        );
    }
}



async function loadAlerts()
{
    try
    {
        const response =
            await fetch(`${API_BASE_URL}/alerts`);

        const result = await response.json();

        const alerts = result.data || [];


        const activeAlerts =
            alerts.filter(
                alert => alert.status === "active"
            );


        document.getElementById("activeAlerts").textContent =
            activeAlerts.length;


        const table =
            document.getElementById("alertTable");

        table.innerHTML = "";


        activeAlerts.forEach(alert =>
            {
                const row = document.createElement("tr");

                const source =
                    alert.gatewayID ||
                    alert.slotID ||
                    "-";

                row.innerHTML = `
                    <td>${source}</td>
                    <td>${alert.alertType}</td>
                    <td>${alert.status}</td>
                    <td>${alert.message}</td>
                `;

                table.appendChild(row);
            });
    }

    catch (error)
    {
        console.error(
            "Failed to load alerts:",
            error
        );
    }
}



async function refreshDashboard()
{
    await loadParkingSpaces();
    await loadAlerts();
}


// Load immediately
refreshDashboard();


// Refresh every 5 seconds
setInterval(refreshDashboard, 5000);
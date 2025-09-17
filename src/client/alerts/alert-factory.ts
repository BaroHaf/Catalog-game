import { throttle } from "@rbxts/set-timeout";
import { store } from "client/store";
import { Alert, selectAlerts } from "client/store/alert";
import { palette } from "shared/constants/palette";

const defaultAlert: Alert = {
	id: 0,
	emoji: "✅",
	message: "Alert",
	color: palette.green,
	duration: 2,
	visible: true,
};

let nextAlertId = 0;


function sendAlertImmediate(patch: Partial<Alert>) {
	const alert: Alert = {
		...defaultAlert,
		...patch,
		id: nextAlertId++,
	};


	store.addAlert(alert);

	Promise.delay(alert.duration).then(() => {
		dismissAlert(alert.id);
	});

	return alert.id;
}

export function sendAlert(patch: Partial<Alert>) {
		return sendAlertImmediate(patch);
}

export async function dismissAlert(id: number) {
	store.setAlertVisible(id, false);

	return Promise.delay(0.25).then(() => {
		store.removeAlert(id);
		return id;
	});
}


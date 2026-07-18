import { render } from "preact";
import { PopupApp } from "./PopupApp";

const root = document.getElementById("app");
if (root) render(<PopupApp />, root);

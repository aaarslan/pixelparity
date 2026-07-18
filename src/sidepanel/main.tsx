import { render } from "preact";
import { SidePanelApp } from "./SidePanelApp";

const root = document.getElementById("app");
if (root) render(<SidePanelApp />, root);

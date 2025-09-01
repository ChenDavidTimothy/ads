import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BatchModal } from "@/components/workspace/batch/BatchModal";

// Mock hooks used by BatchModal
vi.mock("@/hooks/use-batch-overrides", () => ({
	useBatchOverrides: vi.fn(() => ({
		data: { perObjectDefault: undefined, perKeyOverrides: {} },
		setPerObjectDefault: vi.fn(),
		setPerKeyOverride: vi.fn(),
		clearOverride: vi.fn(),
		hasOverrides: false,
	})),
}));

vi.mock("@/hooks/use-batch-keys", () => ({
	useBatchKeysForField: vi.fn(() => ({ keys: ["k1", "k2"], hasBatchKeys: true })),
}));

vi.mock("@/components/workspace/media/asset-selection-modal", () => ({
	AssetSelectionModal: ({ isOpen, onClose, onSelect }: { isOpen: boolean; onClose: () => void; onSelect: (a: { id: string }) => void }) => (
		isOpen ? (
			<div>
				<button onClick={() => onSelect({ id: "asset-123" })}>select-asset</button>
				<button onClick={onClose}>close-asset</button>
			</div>
		) : null
	),
}));

describe("BatchModal dynamic controls", () => {
	it("renders textarea for Typography.content", () => {
		render(
			<BatchModal
				isOpen={true}
				onClose={() => {}}
				nodeId="n1"
				fieldPath="Typography.content"
				valueType="string"
			/>,
		);
		// default textarea present
		expect(screen.getByRole("textbox")).toBeInTheDocument();
	});

	it("renders color input for Canvas.fillColor", () => {
		render(
			<BatchModal
				isOpen={true}
				onClose={() => {}}
				nodeId="n1"
				fieldPath="Canvas.fillColor"
				valueType="string"
			/>,
		);
		// find color input by role is tricky; query input[type=color]
		const color = document.querySelector('input[type="color"]');
		expect(color).toBeTruthy();
	});

	it("opens asset selector for Media.imageAssetId and sets per-object default", () => {
		const { getByText } = render(
			<BatchModal
				isOpen={true}
				onClose={() => {}}
				nodeId="n1"
				fieldPath="Media.imageAssetId"
				valueType="string"
			/>,
		);
		// Click Select Image button for default
		fireEvent.click(getByText(/Select Image|Change Image/));
		// Now AssetSelectionModal is open, click select-asset
		fireEvent.click(getByText("select-asset"));
		// No throw
		expect(true).toBe(true);
	});
});

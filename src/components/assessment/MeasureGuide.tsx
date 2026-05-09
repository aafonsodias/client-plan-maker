import { useTranslation } from "react-i18next";
import { HelpPopover } from "./HelpPopover";
import {
  GuideArm,
  GuideCalf,
  GuideChest,
  GuideHeight,
  GuideHip,
  GuideThigh,
  GuideWaist,
} from "./svg/icons";

const guides = {
  height: { svg: <GuideHeight />, key: "anthro_block.measure_height_instructions" },
  waist: { svg: <GuideWaist />, key: "anthro_block.measure_waist_instructions" },
  hip: { svg: <GuideHip />, key: "anthro_block.measure_hip_instructions" },
  chest: { svg: <GuideChest />, key: "anthro_block.measure_chest_instructions" },
  arm: { svg: <GuideArm />, key: "anthro_block.measure_arm_instructions" },
  thigh: { svg: <GuideThigh />, key: "anthro_block.measure_thigh_instructions" },
  calf: { svg: <GuideCalf />, key: "anthro_block.measure_calf_instructions" },
} as const;

export type MeasureField = keyof typeof guides;

/**
 * MeasureGuide — "Como medir?" trigger that opens a popover with an inline
 * body silhouette + amber dashed line + concise instruction text.
 */
export function MeasureGuide({ field }: { field: MeasureField }) {
  const { t } = useTranslation("assessment");
  const { svg, key } = guides[field];
  const trigger = t("anthro_block.how_to_measure", { defaultValue: "Como medir?" });
  return (
    <HelpPopover label={trigger} triggerLabel={trigger} imageNode={svg}>
      <p>{t(key, { defaultValue: "" })}</p>
    </HelpPopover>
  );
}
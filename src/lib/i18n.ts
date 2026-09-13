export type Lang = "fr" | "en" | "zh";

interface Pack {
  identityPrompt: string;
  identityPlaceholder: string;
  passwordTitle: string;
  passwordPlaceholder: string;
  passwordEnter: string;
  passwordWrong: string;
  passwordLocked: string;
  returnBtn: string;
  send: string;
  thinking: string;
  completeTitle: string;
  completeSub: string;
  rankAchieved: string;
  returnSurface: string;
  inputPlaceholder: string;
  dir: "ltr" | "rtl";
}

export const I18N: Record<Lang, Pack> = {
  en: {
    identityPrompt:
      "Before we continue, Hunter — tell me your first and last name so the club knows who faced the trial.",
    identityPlaceholder: "First and last name...",
    passwordTitle:
      "The Gate recognizes only one code. The Shadow Monarch has shared it with you. Speak it, and enter, Hunter.",
    passwordPlaceholder: "Enter your access code...",
    passwordEnter: "Unlock the Gate",
    passwordWrong: "The shadows do not recognize you. Access denied.",
    passwordLocked: "The gate has sealed itself. Return to the surface, mortal.",
    returnBtn: "Return",
    send: "Send",
    thinking: "the gate is opening...",
    completeTitle: "Interview Complete, Hunter.",
    completeSub: "Your fate has been recorded.",
    rankAchieved: "Rank Achieved",
    returnSurface: "Return to the Surface",
    inputPlaceholder: "Speak your answer...",
    dir: "ltr",
  },
  fr: {
    identityPrompt:
      "Avant de continuer, Chasseur — donne-moi ton nom et prénom pour que le club sache qui a affronté l'épreuve.",
    identityPlaceholder: "Nom et prénom...",
    passwordTitle:
      "La Porte ne reconnaît qu'un seul code. Le Monarque des Ombres te l'a confié. Prononce-le, et entre, Chasseur.",
    passwordPlaceholder: "Entre ton code d'accès...",
    passwordEnter: "Ouvrir la Porte",
    passwordWrong: "Les ombres ne te reconnaissent pas. Accès refusé.",
    passwordLocked: "La porte s'est scellée. Retourne à la surface, mortel.",
    returnBtn: "Retour",
    send: "Envoyer",
    thinking: "la porte s'ouvre...",
    completeTitle: "Entretien terminé, Chasseur.",
    completeSub: "Ton destin a été inscrit.",
    rankAchieved: "Rang Obtenu",
    returnSurface: "Retourner à la Surface",
    inputPlaceholder: "Prononce ta réponse...",
    dir: "ltr",
  },
  zh: {
    identityPrompt: "在继续之前，猎人——告诉我你的姓名，以便俱乐部知道是谁接受了考验。",
    identityPlaceholder: "姓名……",
    passwordTitle: "大门只认一个代码。暗影君主已将它交给你。说出它，然后进入，猎人。",
    passwordPlaceholder: "输入你的访问码……",
    passwordEnter: "解锁大门",
    passwordWrong: "黑暗不认识你。访问被拒绝。",
    passwordLocked: "大门已封印。凡人，回到地面吧。",
    returnBtn: "返回",
    send: "发送",
    thinking: "大门正在开启……",
    completeTitle: "面试完成，猎人。",
    completeSub: "你的命运已被记录。",
    rankAchieved: "达到等级",
    returnSurface: "返回地面",
    inputPlaceholder: "说出你的答案……",
    dir: "ltr",
  },
};

/* ============================================================================
   FUNIL /insta — cadastro de criadoras (SEPARADO do quiz principal)
   3 telas + tela final de obrigado.
============================================================================ */
const INSTA_QUIZ = [
  {
    type: "form",
    id: "insta_social_ig",
    slug: "instagram",
    block: "Instagram",
    title: "Me passa teu Instagram",
    subtitle: "O paizão precisa do teu @ pra te chamar se rolar parceria.",
    fields: [
      {
        id: "instagram_handle",
        label: "Seu @ do Instagram",
        type: "text",
        placeholder: "@seuperfil",
        prefix: "@",
        required: true,
        autocapitalize: "none",
        autocomplete: "username"
      },
      {
        id: "instagram_followers",
        label: "Quantos seguidores você tem?",
        type: "text",
        inputmode: "numeric",
        placeholder: "ex: 12 mil ou 12500",
        required: true
      }
    ],
    cta: "Continuar"
  },
  {
    type: "form",
    id: "insta_social_tt",
    slug: "tiktok",
    block: "TikTok",
    title: "E o TikTok?",
    subtitle: "Se não tiver TikTok, coloca o mesmo @ ou escreve não tenho.",
    fields: [
      {
        id: "tiktok_handle",
        label: "Seu @ do TikTok",
        type: "text",
        placeholder: "@seuperfil",
        prefix: "@",
        required: true,
        autocapitalize: "none",
        autocomplete: "username"
      },
      {
        id: "tiktok_followers",
        label: "Quantos seguidores você tem no TikTok?",
        type: "text",
        inputmode: "numeric",
        placeholder: "ex: 8 mil ou 8000",
        required: true
      }
    ],
    cta: "Continuar"
  },
  {
    type: "choices",
    id: "insta_final",
    slug: "experiencia",
    block: "Sobre você",
    title: "Últimas 2 coisinhas",
    subtitle: "Responde com sinceridade, filhota.",
    questions: [
      {
        id: "ja_fez_publi",
        question: "Já fez alguma publi antes?",
        options: [
          "Sim, já fiz várias",
          "Já fiz uma ou duas",
          "Nunca fiz",
          "Só indicação sem ser paga"
        ]
      },
      {
        id: "conhece_app_paizao",
        question: "Você já conhece o App do Paizão?",
        options: [
          "Sim, já uso / já usei",
          "Já ouvi falar",
          "Conheço o Carlão, mas não o app",
          "Ainda não"
        ]
      }
    ],
    cta: "Enviar pro paizão"
  },
  {
    type: "done",
    id: "insta_done",
    slug: "pronto",
    title: "Pronto, filhota!",
    text: "O paizão já recebeu teus dados. Se rolar match, a gente te chama no direct.",
    sub: "Pode fechar essa página com tranquilidade."
  }
];

window.INSTA_QUIZ = INSTA_QUIZ;

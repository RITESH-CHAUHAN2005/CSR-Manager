// The statutory CSR activity heads — Schedule VII of the Companies Act, 2013.
//
// `value` is the short label that appears in the Category dropdown; `description`
// carries the clause verbatim, so the legal wording is never lost even though nobody
// wants to pick "Eradicating hunger, poverty and malnutrition, promoting health care
// including preventive health care and sanitation…" out of a <select>.
export interface ScheduleVIICategory {
  clause: string
  value: string
  description: string
}

export const SCHEDULE_VII: ScheduleVIICategory[] = [
  {
    clause: '(i)',
    value: 'Hunger, Health & Sanitation',
    description:
      'Schedule VII (i) — Eradicating hunger, poverty and malnutrition, promoting health care including preventive health care and sanitation including contribution to the Swachh Bharat Kosh set-up by the Central Government for the promotion of sanitation and making available safe drinking water.',
  },
  {
    clause: '(ii)',
    value: 'Education & Livelihood',
    description:
      'Schedule VII (ii) — Promoting education, including special education and employment enhancing vocation skills especially among children, women, elderly and the differently abled and livelihood enhancement projects.',
  },
  {
    clause: '(iii)',
    value: 'Gender Equality & Women Empowerment',
    description:
      'Schedule VII (iii) — Promoting gender equality, empowering women, setting up homes and hostels for women and orphans; setting up old age homes, day care centres and such other facilities for senior citizens and measures for reducing inequalities faced by socially and economically backward groups.',
  },
  {
    clause: '(iv)',
    value: 'Environmental Sustainability',
    description:
      'Schedule VII (iv) — Ensuring environmental sustainability, ecological balance, protection of flora and fauna, animal welfare, agroforestry, conservation of natural resources and maintaining quality of soil, air and water including contribution to the Clean Ganga Fund set-up by the Central Government for rejuvenation of river Ganga.',
  },
  {
    clause: '(v)',
    value: 'National Heritage, Art & Culture',
    description:
      'Schedule VII (v) — Protection of national heritage, art and culture including restoration of buildings and sites of historical importance and works of art; setting up public libraries; promotion and development of traditional art and handicrafts.',
  },
  {
    clause: '(vi)',
    value: 'Armed Forces Veterans Welfare',
    description:
      'Schedule VII (vi) — Measures for the benefit of armed forces veterans, war widows and their dependents, Central Armed Police Forces (CAPF) and Central Para Military Forces (CPMF) veterans, and their dependents including widows.',
  },
  {
    clause: '(vii)',
    value: 'Sports Promotion',
    description:
      'Schedule VII (vii) — Training to promote rural sports, nationally recognised sports, paralympic sports and olympic sports.',
  },
  {
    clause: '(viii)',
    value: 'Central Government Funds',
    description:
      "Schedule VII (viii) — Contribution to the Prime Minister's National Relief Fund or Prime Minister's Citizen Assistance and Relief in Emergency Situations Fund (PM CARES Fund) or any other fund set up by the Central Government for socio-economic development and relief and welfare of the Scheduled Castes, Scheduled Tribes, other backward classes, minorities and women.",
  },
  {
    clause: '(ix)(a)',
    value: 'Incubators & R&D',
    description:
      'Schedule VII (ix)(a) — Contribution to incubators or research and development projects in the field of science, technology, engineering and medicine, funded by the Central Government or State Government or Public Sector Undertaking or any agency of the Central Government or State Government.',
  },
  {
    clause: '(ix)(b)',
    value: 'Public Funded Research Bodies',
    description:
      'Schedule VII (ix)(b) — Contributions to public funded Universities; Indian Institutes of Technology (IITs); National Laboratories and autonomous bodies established under the Department of Atomic Energy (DAE), Department of Biotechnology (DBT), Department of Science and Technology (DST), Department of Pharmaceuticals, Ministry of Ayurveda, Yoga and Naturopathy, Unani, Siddha and Homoeopathy (AYUSH), Ministry of Electronics and Information Technology, and other bodies namely Defence Research and Development Organisation (DRDO), Indian Council of Agricultural Research (ICAR), Indian Council of Medical Research (ICMR) and Council of Scientific and Industrial Research (CSIR), engaged in conducting research in science, technology, engineering and medicine aimed at promoting Sustainable Development Goals (SDGs).',
  },
  {
    clause: '(x)',
    value: 'Rural Development',
    description: 'Schedule VII (x) — Rural development projects.',
  },
  {
    clause: '(xi)',
    value: 'Slum Area Development',
    description: 'Schedule VII (xi) — Slum area development.',
  },
  {
    clause: '(xii)',
    value: 'Disaster Management',
    description:
      'Schedule VII (xii) — Disaster management, including relief, rehabilitation and reconstruction activities.',
  },
]

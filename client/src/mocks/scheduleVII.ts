// The statutory CSR activity heads — Schedule VII of the Companies Act, 2013.
// Kept in step with server/src/data/scheduleVII.ts, which is what the live database is
// seeded/migrated from. This copy only backs offline (mock) mode.
//
// Twelve clauses, (i) to (xii). `value` is the short label that appears in the Category
// dropdown; `description` is the clause itself, in plain prose — nobody wants to pick
// "Eradicating hunger, poverty and malnutrition, promoting health care including
// preventive health care and sanitation…" out of a <select>, but the full wording has to
// live somewhere. Clause (ix) has two limbs, (a) and (b); they are one category here,
// with both limbs in the description.
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
      'Eradicating hunger, poverty and malnutrition, promoting health care including preventive health care and sanitation including contribution to the Swachh Bharat Kosh set-up by the Central Government for the promotion of sanitation and making available safe drinking water.',
  },
  {
    clause: '(ii)',
    value: 'Education & Livelihood',
    description:
      'Promoting education, including special education and employment enhancing vocation skills especially among children, women, elderly and the differently abled and livelihood enhancement projects.',
  },
  {
    clause: '(iii)',
    value: 'Gender Equality & Women Empowerment',
    description:
      'Promoting gender equality, empowering women, setting up homes and hostels for women and orphans; setting up old age homes, day care centres and such other facilities for senior citizens and measures for reducing inequalities faced by socially and economically backward groups.',
  },
  {
    clause: '(iv)',
    value: 'Environmental Sustainability',
    description:
      'Ensuring environmental sustainability, ecological balance, protection of flora and fauna, animal welfare, agroforestry, conservation of natural resources and maintaining quality of soil, air and water including contribution to the Clean Ganga Fund set-up by the Central Government for rejuvenation of river Ganga.',
  },
  {
    clause: '(v)',
    value: 'National Heritage, Art & Culture',
    description:
      'Protection of national heritage, art and culture including restoration of buildings and sites of historical importance and works of art; setting up public libraries; promotion and development of traditional art and handicrafts.',
  },
  {
    clause: '(vi)',
    value: 'Armed Forces Veterans Welfare',
    description:
      'Measures for the benefit of armed forces veterans, war widows and their dependents, Central Armed Police Forces (CAPF) and Central Para Military Forces (CPMF) veterans, and their dependents including widows.',
  },
  {
    clause: '(vii)',
    value: 'Sports Promotion',
    description:
      'Training to promote rural sports, nationally recognised sports, paralympic sports and olympic sports.',
  },
  {
    clause: '(viii)',
    value: 'Central Government Funds',
    description:
      "Contribution to the Prime Minister's National Relief Fund or Prime Minister's Citizen Assistance and Relief in Emergency Situations Fund (PM CARES Fund) or any other fund set up by the Central Government for socio-economic development and relief and welfare of the Scheduled Castes, Scheduled Tribes, other backward classes, minorities and women.",
  },
  {
    clause: '(ix)',
    value: 'Research & Development',
    description:
      'Contribution to incubators or research and development projects in the field of science, technology, engineering and medicine, funded by the Central Government or State Government or Public Sector Undertaking or any agency of the Central Government or State Government; and contributions to public funded Universities, Indian Institutes of Technology (IITs), National Laboratories and autonomous bodies established under the Department of Atomic Energy (DAE), Department of Biotechnology (DBT), Department of Science and Technology (DST), Department of Pharmaceuticals, Ministry of Ayurveda, Yoga and Naturopathy, Unani, Siddha and Homoeopathy (AYUSH), Ministry of Electronics and Information Technology, and other bodies namely Defence Research and Development Organisation (DRDO), Indian Council of Agricultural Research (ICAR), Indian Council of Medical Research (ICMR) and Council of Scientific and Industrial Research (CSIR), engaged in conducting research in science, technology, engineering and medicine aimed at promoting Sustainable Development Goals (SDGs).',
  },
  {
    clause: '(x)',
    value: 'Rural Development',
    description: 'Rural development projects.',
  },
  {
    clause: '(xi)',
    value: 'Slum Area Development',
    description: 'Slum area development.',
  },
  {
    clause: '(xii)',
    value: 'Disaster Management',
    description:
      'Disaster management, including relief, rehabilitation and reconstruction activities.',
  },
]

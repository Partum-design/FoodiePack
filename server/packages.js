export const PACKAGES = {
  economico: { tier: 'economico', label: 'Económico', dailyPrice: 60, weeklyRegular: 300, weeklyPrepay: 290, includes: ['1 guisado a elegir', 'Arroz o frijoles', '3 tortillas'] },
  ejecutivo: { tier: 'ejecutivo', label: 'Ejecutivo', dailyPrice: 75, weeklyRegular: 375, weeklyPrepay: 365, includes: ['1 guisado a elegir', 'Arroz y frijoles', 'Huevo hervido opcional', '3 tortillas y salsa'] },
  completo: { tier: 'completo', label: 'Foodie+', dailyPrice: 90, weeklyRegular: 450, weeklyPrepay: 430, includes: ['2 guisados del día', '2 guarniciones', '3 tortillas', 'Agua 500 ml y gelatina'] },
}

export const PACKAGE_ORDER = ['economico', 'ejecutivo', 'completo']

export const REPEAT_GUISADO_SURCHARGE = 15
export const REPEAT_GUISADO_TIER = 'completo'
export const WEEKLY_PLAN_DAYS = 5

export const GARNISH_OPTIONS = ['arroz', 'frijoles']
// Only Económico offers one guarnición to choose; Ejecutivo and Foodie+ already include both.
export const GARNISH_CHOICE_TIER = 'economico'

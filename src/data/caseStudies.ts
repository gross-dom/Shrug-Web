// Case studies are private: the terminal lists them and asks for an access
// request instead of showing them.

export const CASE_STUDIES = ['Varda', 'RTFKT', 'Eight Sleep', 'Feastables', 'Superplastic', 'Superhuman']

export const caseDir = (name: string) => name.toLowerCase().split(' ').join('-') + '/'

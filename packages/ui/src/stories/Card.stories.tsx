import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Criar Memória</CardTitle>
        <CardDescription>Registre um momento especial</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Preencha os detalhes do seu momento...</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancelar</Button>
        <Button>Salvar</Button>
      </CardFooter>
    </Card>
  ),
}

export const Simple: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>12 de Março de 2026</CardTitle>
      </CardHeader>
      <CardContent>
        <p>"Primeiro dia no meu emprego novo."</p>
      </CardContent>
    </Card>
  ),
}
